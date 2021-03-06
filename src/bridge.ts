import { remote, NotificationConstructorOptions } from "electron";
import path from "path";
import { IS_DEV, RESOURCES_PATH } from "./helpers/constants";
import { popupContextMenu } from "./menu/contextMenu";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app, dialog } = remote;

// Electron (or the build of Chromium it uses?) does not seem to have any default right-click menu, this adds our own.
remote.getCurrentWebContents().addListener("context-menu", popupContextMenu);

function createUnreadListener() {
  const unreadObserver = (
    _mutationList: MutationRecord[],
    _observer: MutationObserver
  ) => {
    if (document.querySelector(".unread") != null) {
      app.trayManager?.setUnreadIcon(true);
    } else {
      app.trayManager?.setUnreadIcon(false);
    }
  };
  const observer = new MutationObserver(unreadObserver);
  const node = document.querySelector("main");
  if (node) {
    observer.observe(node, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-e2e-is-unread"],
    });
  }
}

window.addEventListener("load", () => {
  const onInit = (
    _mutationsList: MutationRecord[],
    observer: MutationObserver
  ) => {
    if (document.querySelector("mw-main-nav")) {
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
  if (!app.settings?.startInTrayEnabled.value) {
    app.mainWindow?.show();
  }

  // Note: this hides this during dev
  // remove the condition for testing
  if (!IS_DEV && !app.settings?.seenResetSettingsWarning.value) {
    const message = `
The settings for this app have been reset.

This is a one time occurance and is the result of behind the scenes work to clean up the code.

You may notice two missing settings:

  - Enter to Send: Moved to the 3 dots menu
  - Use System Theme: Removed for the time being in favor of manual operation
    `;
    dialog.showMessageBox({
      type: "info",
      buttons: ["OK"],
      title: "Settings Reset",
      message,
    });
    app.settings?.seenResetSettingsWarning.next(true);
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

  const notificationOpts: NotificationConstructorOptions = app.settings
    ?.hideNotificationContentEnabled.value
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

  notificationOpts.silent = !app.settings?.notificationSoundEnabled.value;

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
  if (!app.mainWindow?.isFocused()) {
    app.mainWindow?.flashFrame(true);
  }
  return notification;
};
// THIS IS NEEDED FOR GOOGLE TO ISSUE NOTIFICATIONS
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Notification.permission = "granted";
Notification.requestPermission = async () => "granted";
