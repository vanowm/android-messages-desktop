import { ipcRenderer, remote, NotificationConstructorOptions } from "electron";
import path from "path";
import {
  EVENT_BRIDGE_INIT,
  EVENT_UPDATE_USER_SETTING,
  SETTING_HIDE_NOTIFICATION,
  RESOURCES_PATH,
  SETTING_NOTIFICATION_SOUND,
  IS_WINDOWS,
} from "./helpers/constants";
import { handleEnterPrefToggle } from "./helpers/inputManager";
import { popupContextMenu } from "./menu/contextMenu";
import settings from "electron-settings";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app } = remote;

import {unreadManager} from "./helpers/unreadManager";

// Electron (or the build of Chromium it uses?) does not seem to have any default right-click menu, this adds our own.
remote.getCurrentWebContents().addListener("context-menu", popupContextMenu);

function createUnreadListener() {
  const observer = new MutationObserver(unreadManager.observer);
  const node = document.querySelector("main");
  if (node) {
    observer.observe(node, {
      subtree: true,
      childList: true, //needed to get notification for already known unread conversation, which just received another new message
      attributes: true,
      attributeFilter: ["data-e2e-is-unread"],
    });
  }
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["changeicon"] //force change icon by adding "changeicon" attribute to BODY
  });
}

window.addEventListener("load", () => {
  const onInit = (
    _mutationsList: MutationRecord[],
    observer: MutationObserver
  ) => {
		//work around for bug https://github.com/electron/electron/issues/27321
		if (IS_WINDOWS)
		{
			setTimeout(function()
			{
				app.mainWindow?.on("focus", function()
				{
					unreadManager.isFocused(true);
				});
				app.mainWindow?.on("blur", function()
				{
					unreadManager.isFocused(false);
				});
			}, 100);
		}
    if (document.querySelector("mw-main-nav")) {
      // we're definitely logged-in if this is in the DOM
      ipcRenderer.send(EVENT_BRIDGE_INIT);
      createUnreadListener();
      observer.disconnect();
    }
    // In the future we could detect the "you've been signed in elsewhere" modal and notify the user here
  };

  const observer = new MutationObserver(onInit);
  observer.observe(document.body, {
    childList: true,
    attributes: true,
  });

  // a work around issue #229 (https://github.com/OrangeDrangon/android-messages-desktop/issues/229)
  if (!settings.get("startInTray")) app.mainWindow?.show();
});
ipcRenderer.on(EVENT_UPDATE_USER_SETTING, (_event, settingsList) => {
  for(let s in settingsList)
  {
    switch(s)
    {
      case "useDarkMode":
        if (settingsList.useDarkMode !== null)
        {
          if (settingsList.useDarkMode) {
            // Props to Google for making the web app use dark mode entirely based on this class
            // and for making the class name semantic!
            document.body.classList.add("dark-mode");
          } else {
            document.body.classList.remove("dark-mode");
          }
        }
        break;
      case "enterToSend":
        handleEnterPrefToggle(settingsList.enterToSend);
        break;
      case "trayEnabledPref":
      case "iconBadgePosition":
      case "iconBadgeScale":
      case "iconBadgeTaskbar":
        document.body.setAttribute("changeicon", "");
        break;
    }
  }
});

/**
 * Override the webview's window's instance of the Notification class and forward their data to the
 * main process. This is Necessary to generate and send a custom notification via Electron instead
 * of just forwarding the webview (Google) ones.
 *
 * Derived from:
 * https://github.com/electron/electron/blob/master/docs/api/ipc-main.md#sending-messages
 * https://stackoverflow.com/questions/2891096/addeventlistener-using-apply
 * https://stackoverflow.com/questions/31231622/event-listener-for-web-notification
 * https://stackoverflow.com/questions/1421257/intercept-javascript-event
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.Notification = function (title: string, options: NotificationOptions) {
  const icon = getProfileImg(title);

  const hideContent = settings.get(SETTING_HIDE_NOTIFICATION, false) as boolean;

  const notificationOpts: NotificationConstructorOptions = hideContent
    ? {
        title: "New Message",
        body: "Click to open",
        icon: path.resolve(RESOURCES_PATH, "icons", "64x64.png"),
      }
    : {
        title,
        icon,
        body: options.body || "",
      };

  notificationOpts.silent = settings.get(
    SETTING_NOTIFICATION_SOUND,
    true
  ) as boolean;

  const notification = new ElectronNotification(notificationOpts);
  notification.addListener("click", () => {
    app.mainWindow?.show();
    document.dispatchEvent(new Event("focus"));
  });
  // Mock the api for adding event listeners for a normal Browser notification
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  notification.addEventListener = notification.addListener;
  notification.show();
 // if (!app.mainWindow?.isFocused()) { //always returns true on Windows when notification popup shown?
  if (!unreadManager.isFocused()) {
    app.mainWindow?.flashFrame(true);
  }
  return notification;
};
// THIS IS NEEDED FOR GOOGLE TO ISSUE NOTIFICATIONS
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Notification.permission = "granted";
Notification.requestPermission = async () => "granted";
