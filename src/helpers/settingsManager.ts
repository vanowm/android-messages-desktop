import settings from "electron-settings";
import {
  SETTING_AUTOHIDE_MENU,
  SETTING_ENTER_TO_SEND,
  SETTING_HIDE_NOTIFICATION,
  SETTING_NOTIFICATION_SOUND,
  SETTING_START_IN_TRAY,
  SETTING_SYSTEM_DARK_MODE,
  SETTING_BADGE_POSITION,
  SETTING_BADGE_SCALE,
  SETTING_BADGE_TASKBAR,
  DEFAULT_BADGE_POSITION,
  DEFAULT_BADGE_SCALE,
  DEFAULT_BADGE_TASKBAR,
  SETTING_TRAY_CONVERSATIONS,
  SETTING_TRAY_CONVERSATIONS_TEXT,
  SETTING_TRAY_CONVERSATIONS_ICON,
  SETTING_TRAY_CONVERSATIONS_SORT,
  DEFAULT_TRAY_CONVERSATIONS,
  DEFAULT_TRAY_CONVERSATIONS_TEXT,
  DEFAULT_TRAY_CONVERSATIONS_ICON,
  DEFAULT_TRAY_CONVERSATIONS_SORT,
} from "./constants";

export class SettingsManager {
  [index:string]:string|number|boolean|Set<string>|Function;
  public startInTray = settings.get(SETTING_START_IN_TRAY, false) as boolean;
  public autoHideMenu = settings.get(SETTING_AUTOHIDE_MENU, false) as boolean;
  public enterToSend = settings.get(SETTING_ENTER_TO_SEND, true) as boolean;

  public notificationSound = settings.get(
    SETTING_NOTIFICATION_SOUND,
    true
  ) as boolean;
  public hideNotificationContent = settings.get(
    SETTING_HIDE_NOTIFICATION,
    false
  ) as boolean;
  public systemDarkMode = settings.get(
    SETTING_SYSTEM_DARK_MODE,
    true
  ) as boolean;
  public iconBadgePosition = settings.get(
  	SETTING_BADGE_POSITION,
  	DEFAULT_BADGE_POSITION
  ) as number;
  public iconBadgeScale = settings.get(
  	SETTING_BADGE_SCALE,
  	DEFAULT_BADGE_SCALE
  ) as number;
  public iconBadgeTaskbar = settings.get(
  	SETTING_BADGE_TASKBAR,
  	DEFAULT_BADGE_TASKBAR
  ) as boolean;

  private watchers: Set<string> = new Set();

  constructor() {
    this.addWatcher<boolean>(
      SETTING_START_IN_TRAY,
      (newVal) => (this.startInTray = newVal)
    );
    this.addWatcher<boolean>(
      SETTING_AUTOHIDE_MENU,
      (newVal) => (this.autoHideMenu = newVal)
    );
    this.addWatcher<boolean>(
      SETTING_ENTER_TO_SEND,
      (newVal) => (this.enterToSend = newVal)
    );
    this.addWatcher<boolean>(
      SETTING_NOTIFICATION_SOUND,
      (newVal) => (this.notificationSound = newVal)
    );
    this.addWatcher<boolean>(
      SETTING_HIDE_NOTIFICATION,
      (newVal) => (this.hideNotificationContent = newVal)
    );
    this.addWatcher<boolean>(
      SETTING_SYSTEM_DARK_MODE,
      (newVal) => (this.systemDarkMode = newVal)
    );
    const list = [[SETTING_TRAY_CONVERSATIONS     , DEFAULT_TRAY_CONVERSATIONS],
                  [SETTING_TRAY_CONVERSATIONS_TEXT, DEFAULT_TRAY_CONVERSATIONS_TEXT],
                  [SETTING_TRAY_CONVERSATIONS_ICON, DEFAULT_TRAY_CONVERSATIONS_ICON],
                  [SETTING_TRAY_CONVERSATIONS_SORT, DEFAULT_TRAY_CONVERSATIONS_SORT],

                 ];
    for(let i = 0; i < list.length; i++)
    {
      const key = list[i][0] as string,
            val = list[i][1];

      this[key] = settings.get(key, val) as typeof val;
      this.addWatcher<boolean>(
        key,
        (newVal) => this[key] = newVal
      );

    }
  }

  public addWatcher<T>(name: string, callback: (newVal: T) => unknown): void {
    settings.watch(name, callback);
    this.watchers.add(name);
  }

  public clearWatchers(): void {
    this.watchers.forEach((name) => settings.removeAllListeners(name));
  }
}
