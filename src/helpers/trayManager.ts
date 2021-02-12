import { app, Menu, Tray } from "electron";
import settings from "electron-settings";
import path from "path";
import { trayMenuTemplate } from "../menu/trayMenu";
import {
  IS_LINUX,
  IS_MAC,
  IS_WINDOWS,
  RESOURCES_PATH,
  SETTING_TRAY_ENABLED,
} from "./constants";

const { name } = require('../../package.json');
const uuid = require('uuid');

export class TrayManager {
  public enabled = settings.get(SETTING_TRAY_ENABLED, !IS_LINUX) as boolean;
  public iconPath = this.getIconPath();
  public overlayIconPath = this.getOverlayIconPath();

  public tray: Tray | null = null;

  constructor() {
    this.handleTrayEnabledToggle = this.handleTrayEnabledToggle.bind(this);
  }

  private getIconPath(): string {
    if (IS_WINDOWS) {
      // Re-use regular app .ico for the tray icon on Windows.
      return path.resolve(RESOURCES_PATH, "icon.ico");
    } else {
      // Mac tray icon filename MUST end in 'Template' and contain only black and transparent pixels.
      // Otherwise, automatic inversion and dark mode appearance won't work.
      // See: https://stackoverflow.com/questions/41664208/electron-tray-icon-change
      const trayIconFileName = IS_MAC ? "icon_macTemplate.png" : "icon.png";
      return path.resolve(RESOURCES_PATH, "tray", trayIconFileName);
    }
  }

  private getOverlayIconPath(): string | null {
    if (IS_WINDOWS) {
      return path.resolve(RESOURCES_PATH, "tray", "unread_icon.ico");
    } else if (IS_LINUX) {
      return path.resolve(RESOURCES_PATH, "tray", "unread_icon.png");
    }
    return null;
  }

  public startIfEnabled(): void {
    if (this.enabled) {
      this.tray = new Tray(this.iconPath, uuid.v5(name + app.getAppPath(), "127d083c-9721-323f-9403-a0b520fbc475"));
      const trayContextMenu = Menu.buildFromTemplate(trayMenuTemplate);
      this.tray.setContextMenu(trayContextMenu);
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (this.tray != null) {
      this.tray.on("click", this.handleTrayClick);
    }
  }

  private destroyEventListeners() {
    if (this.tray != null) {
      this.tray.removeListener("click", this.handleTrayClick);
      this.tray.removeListener("double-click", this.handleTrayClick);
    }
  }

  private handleTrayClick(_event: Electron.KeyboardEvent) {
    app.mainWindow?.show();
  }

  private destroy(): void {
    if (this.tray) {
      this.destroyEventListeners();
      this.tray.destroy();
      this.tray = null;
    }
  }

  public showMinimizeToTrayWarning(): void {
    if (IS_WINDOWS && this.enabled) {
      const seenMinimizeToTrayWarning = settings.get(
        "seenMinimizeToTrayWarningPref",
        false
      ) as boolean;
      if (!seenMinimizeToTrayWarning && this.tray != null) {
        this.tray.displayBalloon({
          title: "Android Messages",
          content:
            "Android Messages is still running in the background. To close it, use the File menu or right-click on the tray icon.",
        });
        settings.set("seenMinimizeToTrayWarningPref", true);
      }
    }
  }

  public handleTrayEnabledToggle(newValue: boolean): void {
    this.enabled = newValue;
    const liveStartInTrayMenuItemRef = Menu.getApplicationMenu()?.getMenuItemById(
      "startInTrayMenuItem"
    );

    if (newValue) {
      if (!IS_MAC && liveStartInTrayMenuItemRef != null) {
        // Must get a live reference to the menu item when updating their properties from outside of them.
        liveStartInTrayMenuItemRef.enabled = true;
      }
      if (!this.tray) {
        this.startIfEnabled();
      }
    }
    if (!newValue) {
      if (this.tray) {
        this.destroy();
        if (!IS_MAC) {
          if (!app.mainWindow?.isVisible()) {
            app.mainWindow?.show();
          }
        }
      }
      if (!IS_MAC && liveStartInTrayMenuItemRef != null) {
        // If the app has no tray icon, it can be difficult or impossible to re-gain access to the window, so disallow
        // starting hidden, except on Mac, where the app window can still be un-hidden via the dock.
        settings.set("startInTrayPref", false);
        liveStartInTrayMenuItemRef.enabled = false;
        liveStartInTrayMenuItemRef.checked = false;
      }
      if (IS_LINUX) {
        // On Linux, the call to tray.destroy doesn't seem to work, causing multiple instances of the tray icon.
        // Work around this by quickly restarting the app.
        app.relaunch();
        app.exit(0);
      }
    }
  }

  public setUnreadIcon(toggle: boolean): void {
    if (this.tray && this.overlayIconPath != null) {
      this.tray.setToolTip("Android Messages");
      if (toggle) {
        this.tray.setImage(this.overlayIconPath);
      } else {
        this.tray.setImage(this.iconPath);
      }
    }
  }
}
