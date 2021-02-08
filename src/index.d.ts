import { CustomBrowserWindow } from "./helpers/window";
import { TrayManager } from "./helpers/trayManager";
import { UnreadManager } from "./helpers/unreadManager";

declare global {
  interface Window {
    getUserImg: (name: string) => Promise<string | undefined>;
  }

  namespace Electron {
    interface App {
      mainWindow?: CustomBrowserWindow;
      trayManager?: TrayManager;
      unreadManager?: UnreadManager
    }
  }
}
