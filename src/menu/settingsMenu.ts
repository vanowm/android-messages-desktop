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
  DEFAULT_BADGE_POSITION,
  DEFAULT_BADGE_SCALE,
} from "../helpers/constants";
import { separator } from "./items/separator";

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
    separator,
    {
      id: "pressEnterToSendMenuItem",
      label: "Press Enter to Send Message",
      type: "checkbox",
      click: (item) => {
        settings.set("pressEnterToSendPref", item.checked);
      },
    },
    separator,
    {
      id: "hideNotificationContentMenuItem",
      label: "Hide Notification Content",
      type: "checkbox",
      click: (item) => {
        settings.set("hideNotificationContentPref", item.checked);
      },
    },
    separator,
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
  let submenu:any = [],
      // since Electron doesn't provide any means highlight default menu item, we can use UNICODE bold/italic characters instead
      defaultHighlight = (():Function =>
      {
        let type = [
                     /*bold*/        [120211 /*A-Z*/, 120205 /*a-z*/, 120764 /*0-9*/],
                     /*bold-italic*/ [120315 /*A-Z*/, 120309 /*a-z*/, 120764 /*0-9 (no italic available)*/]
                  ];
        return (text:string|number, t:any):string =>
        {
            t = type[t] || t && t.length == 3 ? t : type[0];
          return (text + "").replace(/[a-zA-Z0-9]/g, (a) => String.fromCodePoint((a.codePointAt(0) || 0) + t[/[0-9]/.test(a) ? 2 : /[a-z]/.test(a) ? 1 : 0]));
        }
      })();

  for(let i = 0, l = ["Top Left", "Top Right", "Bottom Right", "Bottom Left", "Center"]; i < l.length; i++)
  {
    submenu[submenu.length] = {
      id: "iconBadgePosition" + i,
      label: i == DEFAULT_BADGE_POSITION ? defaultHighlight(l[i]) : l[i],
      value: i,
      type: "radio",
      click: (item:any) => {
        settings.set("iconBadgePosition", item.value);
      },
    };
  }
  settingsMenu.submenu.push({
    id: "iconBadgePosition",
    label: "Unread icon badge position",
    submenu: submenu
  });

  submenu = [];
  for(let i = 0.25, n; i <= 2; i += 0.25)
  {
    n = i * 100 + "%";
    submenu[submenu.length] = {
      id: "iconBadgeScale" + i,
      label: i == DEFAULT_BADGE_SCALE ? defaultHighlight(n) : n,
      value: i,
      type: "radio",
      click: (item:any) => {
        settings.set("iconBadgeScale", item.value);
      },
    };
  }
  settingsMenu.submenu.push({
    id: "iconBadgeScale",
    label: "Unread icon badge size",
    submenu: submenu
  });
  if (IS_WINDOWS)
  {
    settingsMenu.submenu.push({
      id: "iconBadgeTaskbar",
      label: "Unread icon badge on taskbar",
      type: "checkbox",
      click: (item) => {
        settings.set(item.id, item.checked);
      },
    });
  }

}
