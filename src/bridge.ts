import { ipcRenderer, remote, NotificationConstructorOptions } from "electron";
import path from "path";
import {
  EVENT_BRIDGE_INIT,
  EVENT_UPDATE_USER_SETTING,
  SETTING_HIDE_NOTIFICATION,
  RESOURCES_PATH,
  SETTING_NOTIFICATION_SOUND,
  SETTING_START_IN_TRAY,
  EVENT_OPEN_CONVERSATION,
  SETTING_MENU_CONVERSATIONS,
  DEFAULT_MENU_CONVERSATIONS,
  Conversation,
} from "./helpers/constants";
import { handleEnterPrefToggle } from "./helpers/inputManager";
import { popupContextMenu } from "./menu/contextMenu";
import settings from "electron-settings";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app } = remote;

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
            conv = convList.children[i];
            if (data = conv.querySelector("[data-e2e-conversation-name]"))
              info.name = data.textContent as string;

            if (data = conv.querySelector("mws-conversation-snippet"))
              info.text = data.textContent as string;

            if (data = conv.querySelector("canvas.canvas-avatar") as HTMLCanvasElement)
            {
              const canvas = document.createElement("canvas"),
                    ctx = canvas.getContext("2d") as CanvasRenderingContext2D,
                    size = 24;
              canvas.width = size;
              canvas.height = size;
              ctx.drawImage(data, 0, 0, size, size);
              info.icon = canvas.toDataURL();
            }

            if (data = conv.querySelector("a[data-e2e-conversation]") as HTMLAnchorElement)
              info.id = data.getAttribute("href") as string;

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
});

ipcRenderer.on(EVENT_UPDATE_USER_SETTING, (_event, settingsList) => {
  if ("useDarkMode" in settingsList && settingsList.useDarkMode !== null) {
    if (settingsList.useDarkMode) {
      // Props to Google for making the web app use dark mode entirely based on this class
      // and for making the class name semantic!
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }
  if ("enterToSend" in settingsList) {
    handleEnterPrefToggle(settingsList.enterToSend);
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
