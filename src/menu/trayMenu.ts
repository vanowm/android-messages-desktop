import { app, MenuItemConstructorOptions } from "electron";
import { IS_MAC } from "../helpers/constants";

export const trayMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: "Show/Hide Android Messages",
    click: (): void => {
      const mainWindow = app.mainWindow;
      if (mainWindow != null) {
        if (mainWindow.isVisible()) {
          if (IS_MAC) {
            app.hide();
          } else {
            mainWindow.hide();
          }
        } else {
          mainWindow.show();
        }
      }
    },
  },
  {
    type: "separator",
  },
  {
    label: "Exit",
    click: (): void => {
      app.quit();
    },
  },
];
