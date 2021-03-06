import { remote, WebviewTag } from "electron";
import { IS_MAC, IS_DEV } from "./helpers/constants";
import "./stylesheets/main.css";

const app = remote.app;

const androidMessagesWebview = document.getElementById(
  "androidMessagesWebview"
) as WebviewTag;

androidMessagesWebview.addEventListener("dom-ready", () => {
  if (IS_DEV) {
    androidMessagesWebview.openDevTools();
  }
  app.mainWindow?.on("focus", () => {
    // Dispatches a focus event for QOL allowing the webview to put our cursor where it belongs
    androidMessagesWebview.dispatchEvent(new Event("focus"));
  });
  if (IS_MAC) {
    androidMessagesWebview.insertCSS(
      ".main-nav-header .logo {text-align:center; transform: translateX(10px)}"
    );
  }
});
