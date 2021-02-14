import { ipcRenderer, remote, NotificationConstructorOptions } from "electron";
import path from "path";
import {
  EVENT_BRIDGE_INIT,
  EVENT_UPDATE_USER_SETTING,
  SETTING_HIDE_NOTIFICATION,
  RESOURCES_PATH,
  SETTING_NOTIFICATION_SOUND,
  SETTING_START_IN_TRAY,
  SETTING_SYSTEM_DARK_MODE,
  BASE_APP_PATH,
} from "./helpers/constants";
import { handleEnterPrefToggle } from "./helpers/inputManager";
import { popupContextMenu } from "./menu/contextMenu";
import settings from "electron-settings";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app, nativeTheme } = remote;

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
  if (!settings.get(SETTING_START_IN_TRAY)) app.mainWindow?.show();
});

// dark mode work around issue #258 (https://github.com/OrangeDrangon/android-messages-desktop/issues/258)
let isDarkMode!:boolean;

function darkMode(mode:boolean)
{
  localStorage.setItem("dark_mode_enabled", "" + (mode === true));
  if (mode)
    document.body?.classList.add("dark-theme");
  else if (!isDarkMode)
      document.body?.classList.remove("dark-theme");
}
// force google insert dark-theme
// unfortunate side effect is the splash screen will always be dark
darkMode(true);

window.addEventListener("DOMContentLoaded", function(e)
{
  const darkStyle = document.createElement("style") as HTMLElement;
  darkStyle.id = "dark-theme";
  document.head.prepend(darkStyle);

  // theme setting is stored in google account and restored on initial load
  // dark theme style inserted/remeoved according to that setting
  // capture the style and copy to ours that will remain when google removes theirs
  new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
  {
    for(let i = 0; i < m.length; i++)
    {
      for(let n = 0, style; n < m[i].addedNodes.length; n++)
      {
        style = m[i].addedNodes[n] as HTMLStyleElement;
        if (style.textContent?.substr(0, 15) == "body.dark-theme")
        {
          isDarkMode = true;
          darkStyle.innerHTML = style.innerHTML;
        }
      }
      for(let n = 0, style; n < m[i].removedNodes.length; n++)
      {
        style = m[i].removedNodes[n] as HTMLStyleElement;
        if (style.textContent?.substr(0, 15) == "body.dark-theme")
        {
          isDarkMode = false;
          // allow google complete switching theme
          setTimeout(()=>
          {
            if (settings.get(SETTING_SYSTEM_DARK_MODE))
              darkMode(nativeTheme.shouldUseDarkColors)
          }, 0);
        }
      }
    }
  }).observe(document.head, {
    childList: true
  });

  const systemDarkDisable = ()=>
  {
    settings.set(SETTING_SYSTEM_DARK_MODE, false);
  }

  // add click listeners to the enable/disable dark theme buttons in 3dot menu
  new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
  {
    for(let i = 0; i < m.length; i++)
    {
      for(let n = 0, node; n < m[i].addedNodes.length; n++)
      {
        node = m[i].addedNodes[n] as HTMLElement;
        if (node?.id == "mat-menu-panel-0")
        {
          node.querySelector('[data-e2e-main-nav-menu="ENABLE_DARK_MODE"]')?.addEventListener("click", systemDarkDisable);
          node.querySelector('[data-e2e-main-nav-menu="DISABLE_DARK_MODE"]')?.addEventListener("click", systemDarkDisable);
        }
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
});// DOMContentLoaded

ipcRenderer.on(EVENT_UPDATE_USER_SETTING, (_event, settingsList) => {
  if ("useDarkMode" in settingsList) {
    darkMode(settingsList.useDarkMode);
  }

  if ("enterToSend" in settingsList) {
    handleEnterPrefToggle(settingsList.enterToSend);
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
