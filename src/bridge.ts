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
  IS_WINDOWS,
  SETTING_BADGE_POSITION,
  SETTING_BADGE_SCALE,
  SETTING_BADGE_TASKBAR,
  EVENT_OPEN_CONVERSATION,
  SETTING_MENU_CONVERSATIONS,
  DEFAULT_MENU_CONVERSATIONS,
  Conversation,
} from "./helpers/constants";
import { handleEnterPrefToggle } from "./helpers/inputManager";
import { popupContextMenu } from "./menu/contextMenu";
import settings from "electron-settings";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app, nativeTheme } = remote;

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

function createConversationListeners()
{
  const node = document.querySelector("mws-conversations-list > nav.conversation-list");
  if (!node)
    return;

  let observer:MutationObserver;
  new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
  {
    for(let i = 0; i < m.length; i++)
    {
      for(let a = 0; a < m[i].addedNodes.length; a++)
      {
        const convList = m[i].addedNodes[a] as HTMLElement;
        if (!convList.classList.contains("conv-container"))
          continue;

        let lastList:Array<Conversation> = [];
        const setList = () =>
        {
          const list:Array<Conversation> = [];
          // gather information about conversations
          // in the future we can use settings to store number of conversations to show
//          for(let i = 0, conv, data; i < Math.min(settings.get(SETTING_MENU_CONVERSATIONS, DEFAULT_MENU_CONVERSATIONS) as number, convList.children.length); i++)
          for(let i = 0, conv, data; i < Math.min(DEFAULT_MENU_CONVERSATIONS, convList.children.length); i++)
          {
            const info = {} as Conversation;
            let unread = false;
            conv = convList.children[i];
            if (data = conv.querySelector("[data-e2e-conversation-name]"))
              info.name = data.textContent as string;

            if (data = conv.querySelector("mws-conversation-snippet"))
              info.text = data.textContent as string;

            if (data = conv.querySelector("a[data-e2e-conversation]") as HTMLAnchorElement)
            {
              unread = data.getAttribute("data-e2e-is-unread") == "true";
              info.id = data.getAttribute("href") as string;
            }

            if (data = conv.querySelector("canvas.canvas-avatar") as HTMLCanvasElement)
            {
              const canvas = document.createElement("canvas"),
                    ctx = canvas.getContext("2d") as CanvasRenderingContext2D,
                    size = 24;
              canvas.width = size;
              canvas.height = size;
              ctx.drawImage(data, 0, 0, size, size);
              if (unread)
              {
                ctx.fillStyle = "red";
                ctx.strokeStyle = "white";
                ctx.lineWidth = 1;
                ctx.arc(21, 3, 2.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
              }
              info.icon = canvas.toDataURL();
            }


            list[list.length] = info;
          }
          // compare to previous list
          let update = false;
          for(let i = 0, c = Math.max(lastList.length, list.length); i < c; i++)
          {
            if (update = !list[i] || !lastList[i])
              break;

            for(let n in list[i])
            {
              if (update = list[i][n] != lastList[i][n])
              {
                c = 0;
                break;
              }
            }
          }
          if (!update)
            return;

          lastList = list;
          app.trayManager?.setConversationList(list);
        } // setList();

        observer && observer.disconnect();
        let timer:NodeJS.Timer;
        observer = new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
        {
          let canvas = false;
          for(let i = 0; i < m.length; i++)
          {
            if (canvas = (m[i].target as HTMLElement).tagName == "CANVAS")
              break;
          }
          if (!canvas)
            return;

          clearTimeout(timer);
          timer = setTimeout(setList, 200);
        });
        observer.observe(convList,
        {
          subtree: true,
          attributes: true,
          attributeFilter: ["width"]
        });
      } // for m[i].addedNodes
    } // for m
  }).observe(node, {childList: true});
} // createConversationListeners()

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
      createConversationListeners();
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
  // part of #217 (https://github.com/OrangeDrangon/android-messages-desktop/issues/217)
  const style = document.createElement("style");
  style.innerHTML = 'body.hiddenOverlay mws-lightbox, body.hiddenOverlay [class*="cdk-overlay"], body.hiddenOverlay [class*="cdk-overlay"] *{display:none!important;z-index:-999999!important;visibility:hidden!important;position:absolute!important;left:-100%!important;top:-100%!important;width:0!important;height:0!important}';
  document.head.appendChild(style);
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
  for(let s in settingsList)
  {
    switch(s)
    {
      case "useDarkMode":
        darkMode(settingsList.useDarkMode);
        break;
      case "enterToSend":
        handleEnterPrefToggle(settingsList.enterToSend);
        break;
      case "trayEnabledPref":
      case SETTING_BADGE_POSITION:
      case SETTING_BADGE_SCALE:
      case SETTING_BADGE_TASKBAR:
        document.body.setAttribute("changeicon", "");
        break;
    }
  }
});

ipcRenderer.on(EVENT_OPEN_CONVERSATION, (_event, id) =>
{
  (document.querySelector('mws-conversation-list-item > a[href="' + id + '"]') as HTMLElement).click();
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

  const isSound = settings.get(SETTING_NOTIFICATION_SOUND,true) as boolean;
  notificationOpts.silent = true; //disable system's notification sound

  const notification = new ElectronNotification(notificationOpts);
  notification.addListener("click", () => {
    app.mainWindow?.show();
    document.dispatchEvent(new Event("focus"));
    if (!isSound)
    {
      // if notification sound disabled,
      // we are forcing google code to fail by not providing addEventListener function (or we could simply not return notification all together)
      // therefore we must handle click on notification ourselves:
      // search conversation by ID and activate it.
      (document.querySelector('a[href$="/' + options.data.id + '"]') as HTMLElement).click();
    }
  });
  if (isSound)
  {
    // Mock the api for adding event listeners for a normal Browser notification
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    notification.addEventListener = notification.addListener;
  }
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
