import {
  BrowserWindow,
  dialog,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
} from "electron";

import settings from "electron-settings";
import {
  IS_LINUX,
  IS_MAC, IS_WINDOWS,
  SETTING_TRAY_ENABLED,
  SETTING_BADGE_POSITION,
  SETTING_BADGE_SCALE,
  SETTING_BADGE_TASKBAR,
  SETTING_TRAY_CONVERSATIONS,
  SETTING_TRAY_CONVERSATIONS_TEXT,
  SETTING_TRAY_CONVERSATIONS_ICON,
  TRAY_CONVERSATIONS_MAX,
  SETTING_TRAY_CONVERSATIONS_SORT,
} from "../helpers/constants";
import { separator } from "./items/separator";

import { unreadManager } from "../helpers/unreadManager";

export const settingsMenu: MenuItemConstructorOptions = {
  label: IS_MAC ? "&Preferences" : "&Settings",
  accelerator: IS_MAC ? "Alt+P" : "Alt+S",
  submenu: [
    {
      // This option doesn't apply to Mac, so this hides it but keeps the order of menu items
      // to make updating based on array indices easier.
      visible: !IS_MAC,
      id: "autoHideMenuBarMenuItem",
      label: "Auto Hide Menu Bar",
      type: "checkbox",
      click: (item: MenuItem, window?: BrowserWindow): void => {
        const autoHideMenuPref = !settings.get("autoHideMenuPref");
        settings.set("autoHideMenuPref", autoHideMenuPref);
        item.checked = autoHideMenuPref;
        window?.setMenuBarVisibility(!autoHideMenuPref);
        window?.setAutoHideMenuBar(autoHideMenuPref);
      },
    },
    {
      id: "enableTrayIconMenuItem",
      label: IS_MAC ? "Enable Menu Bar Icon" : "Enable Tray Icon",
      type: "checkbox",
      click: async (item: MenuItem): Promise<void> => {
        const trayEnabledPref = !settings.get(SETTING_TRAY_ENABLED);
        let confirmClose = true;
        if (IS_LINUX && !trayEnabledPref) {
          const dialogAnswer = await dialog.showMessageBox({
            type: "question",
            buttons: ["Restart", "Cancel"],
            title: "App Restart Required",
            message:
              "Changing this setting requires Android Messages to be restarted.\n\nUnsent text messages may be deleted. Click Restart to apply this setting change and restart Android Messages.",
          });
          if (dialogAnswer.response === 1) {
            confirmClose = false;
            item.checked = true; // Don't incorrectly flip checkmark if user canceled the dialog
          }
        }

        if (confirmClose) {
          settings.set(SETTING_TRAY_ENABLED, trayEnabledPref);
          item.checked = trayEnabledPref;
        }
      },
    },
    {
      id: "startInTrayMenuItem",
      label: IS_MAC ? "Start Hidden" : "Start In Tray",
      type: "checkbox",
      click: (item: MenuItem): void => {
        const startInTrayPref = !settings.get("startInTrayPref");
        settings.set("startInTrayPref", startInTrayPref);
        item.checked = startInTrayPref;
      },
    },
  ],
};

if (settingsMenu.submenu != null && !(settingsMenu.submenu instanceof Menu)) {
  // Electron doesn't seem to support the visible property for submenus, so push it instead of hiding it in non-Windows
  // See: https://github.com/electron/electron/issues/8703

  settingsMenu.submenu.push(
    separator,
    {
      id: "notificationSoundEnabledMenuItem",
      label: "Play Notification Sound",
      type: "checkbox",
      click: (item) => {
        settings.set("notificationSoundEnabledPref", item.checked);
      },
    },
    {
      id: "hideNotificationContentMenuItem",
      label: "Hide Notification Content",
      type: "checkbox",
      click: (item) => {
        settings.set("hideNotificationContentPref", item.checked);
      },
    },
    {
      id: "pressEnterToSendMenuItem",
      label: "Press Enter to Send Message",
      type: "checkbox",
      click: (item) => {
        settings.set("pressEnterToSendPref", item.checked);
      },
    },
    {
      id: "useSystemDarkModeMenuItem",
      label: "Use System Dark Mode Setting",
      type: "checkbox",
      click: (item) => {
        settings.set("useSystemDarkModePref", item.checked);
      },
    }
  );
/* unread badge */
  settingsMenu.submenu.push(separator)
  settingsMenu.submenu.push(unreadManager.getMenu(SETTING_BADGE_POSITION))
  settingsMenu.submenu.push(unreadManager.getMenu(SETTING_BADGE_SCALE));
  if (IS_WINDOWS)
  {
    settingsMenu.submenu.push(unreadManager.getMenu(SETTING_BADGE_TASKBAR));
  }

/* tray conversations */
  const click = (item:any) =>
  {
    const id = item.id.replace(/[0-9]+$/, ""),
          val = item.type == "radio" ? item.value : item.checked;

    settings.set(id, val);
  }
  const submenuNum:Array<Object> = [];
  for(let i = 0; i <= TRAY_CONVERSATIONS_MAX; i++)
  {
    submenuNum[submenuNum.length] = {
      id: SETTING_TRAY_CONVERSATIONS + i,
      value: i,
      label: i ? "" + i : "None",
      type: "radio",
      click: click,
    };
  }
  const submenuIcon:Array<Object> = [];
  for(let i = 0; i < 5; i++)
  {
    const val = i ? (i * 8 + 8) : 0;
    submenuIcon[submenuIcon.length] = {
      id: SETTING_TRAY_CONVERSATIONS_ICON + val,
      value: val,
      label: i ? i * 50 + "%" : "Hidden",
      type: "radio",
      click: click,
    };
  }
  settingsMenu.submenu.push(
  separator,
  {
    label: "Conversations In Tray",
    submenu:
    [
      {
        id: SETTING_TRAY_CONVERSATIONS,
        label: "Show",
        submenu: submenuNum
      },
      {
        id: SETTING_TRAY_CONVERSATIONS_ICON,
        label: "Avatar size",
        submenu: submenuIcon
      },
      {
        id: SETTING_TRAY_CONVERSATIONS_TEXT,
        label: "Show text",
        type: "checkbox",
        click: click
      },
      {
        id: SETTING_TRAY_CONVERSATIONS_SORT,
        label: "Sort Alphabetically",
        type: "checkbox",
        click: click
      },
    ]
  });
}
