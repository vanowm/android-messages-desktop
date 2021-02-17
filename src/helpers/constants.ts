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

export const TRAY_CONVERSATIONS_MAX = 10; //number of conversations to show in tray menu
// Settings
export const SETTING_TRAY_ENABLED = "trayEnabledPref";
export const SETTING_CUSTOM_WORDS = "savedCustomDictionaryWords";
export const SETTING_NOTIFICATION_SOUND = "notificationSoundEnabledPref";
export const SETTING_ENTER_TO_SEND = "pressEnterToSendPref";
export const SETTING_HIDE_NOTIFICATION = "hideNotificationContentPref";
export const SETTING_SYSTEM_DARK_MODE = "useSystemDarkModePref";
export const SETTING_START_IN_TRAY = "startInTrayPref";
export const SETTING_AUTOHIDE_MENU = "autoHideMenuPref";
export const SETTING_TRAY_CONVERSATIONS = "trayConversationsLimit";
export const DEFAULT_TRAY_CONVERSATIONS = TRAY_CONVERSATIONS_MAX;
export const SETTING_TRAY_CONVERSATIONS_TEXT = "trayConversationsText";
export const DEFAULT_TRAY_CONVERSATIONS_TEXT = false;
export const SETTING_TRAY_CONVERSATIONS_ICON = "trayConversationsIcon";
export const DEFAULT_TRAY_CONVERSATIONS_ICON = 24; //avatar size

// Events
export const EVENT_BRIDGE_INIT = "messages-bridge-init";
export const EVENT_UPDATE_USER_SETTING = "messages-update-user-setting";
export const EVENT_OPEN_CONVERSATION = "messages-open-conversation";

export interface Conversation {
  name: string;
  text: string;
  icon: string;
  id: string;
  [key: string]: string;
}
