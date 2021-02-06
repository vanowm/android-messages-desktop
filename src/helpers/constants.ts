import process from "process";
import path from "path";

export const osMap = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
  aix: "AIX",
  android: "Android",
  freebsd: "FreeBSD",
  openbsd: "OpenBSD",
  sunos: "SunOS",
  cygwin: "CygWin",
  netbsd: "NetBSD",
};

// Operating system
const OS_NAME = process.platform;
export const OS_NAME_FRIENDLY = osMap[OS_NAME];
export const IS_WINDOWS = OS_NAME === "win32";
export const IS_MAC = OS_NAME === "darwin";
export const IS_LINUX = OS_NAME === "linux";

// Environment and paths
export const IS_DEV = process.env.NODE_ENV === "development";
export const BASE_APP_PATH = path.resolve(__dirname, "..");
export const RESOURCES_PATH = path.resolve(BASE_APP_PATH, "resources");

// Settings
export const SETTING_TRAY_ENABLED = "trayEnabledPref";
export const SETTING_CUSTOM_WORDS = "savedCustomDictionaryWords";
export const SETTING_NOTIFICATION_SOUND = "notificationSoundEnabledPref";
export const SETTING_ENTER_TO_SEND = "pressEnterToSendPref";
export const SETTING_HIDE_NOTIFICATION = "hideNotificationContentPref";
export const SETTING_SYSTEM_DARK_MODE = "useSystemDarkModePref";
export const SETTING_START_IN_TRAY = "startInTrayPref";
export const SETTING_AUTOHIDE_MENU = "autoHideMenuPref";
export const SETTING_BADGE_POSITION = "iconBadgePosition";
export const SETTING_BADGE_SCALE = "iconBadgeScale";
export const SETTING_BADGE_TASKBAR = "iconBadgeTaskbar";
export const DEFAULT_BADGE_POSITION = 1;
export const DEFAULT_BADGE_SCALE = 1;
export const DEFAULT_BADGE_TASKBAR = true;

// Events
export const EVENT_BRIDGE_INIT = "messages-bridge-init";
export const EVENT_UPDATE_USER_SETTING = "messages-update-user-setting";
