import {
  ContextMenuParams,
  MenuItemConstructorOptions,
  remote,
  clipboard,
} from "electron";

const { Menu, app } = remote;

// WARNING THIS IS THE ONLY PLACE LEFT WITH FORCE TYPECASTS TO ANY
// IT HAS NO SIDE EFFECTS
// I WOULD NOT DO IT BUT I AM NOT POSITIVE HOW TO PROPERLY TYPE IT

const standardMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: "Copy",
  },
  {
    label: "Copy Link",
  },
  {
    type: "separator",
  },
  {
    label: "Select All",
  },
];

const textMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: "Undo",
    role: "undo",
  },
  {
    label: "Redo",
    role: "redo",
  },
  {
    type: "separator",
  },
  {
    label: "Cut",
    role: "cut",
  },
  {
    label: "Copy",
    role: "copy",
  },
  {
    label: "Paste",
    role: "paste",
  },
  {
    type: "separator",
  },
  {
    label: "Select All",
    role: "selectAll",
  },
];
const cacheURL:Map<string, string> = new Map();
const findMsg = function (node:Element|Element|null):HTMLElement|null
{
  if (!node)
    return null;

  if (node.tagName == "MWS-MESSAGE-PART-CONTENT")
    return node as HTMLElement;

  return findMsg(node.parentNode as Element );
}

export const popupContextMenu = async (
  event: Electron.Event,
  params: ContextMenuParams
): Promise<void> => {
  switch (params.mediaType) {
    case "video":
    case "image":
      if (!params.srcURL || !params.srcURL.length)
        break;

      const mediaType =
        params.mediaType[0].toUpperCase() + params.mediaType.slice(1);

      let url = params.srcURL,
          menuIsClosing = false;

      const saveAs = () =>
      {
        const link = document.createElement('a'),
              d = new Date(),
              download = (url:string) =>
              {
                link.href = url;
                link.download = "IMG_" + d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              },
              pad = (t:number) => ("0" + t).substr(-2);

        if (url.match(/^blob:/i))
        {
          download(url);
        }
        else
        {
          //using AJAX to prevent non-blob images from being opened instead of downloaded (i.e preview of web links)
          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "blob";
          xhr.onload = function()
          {
          	const url = window.URL.createObjectURL(this.response);
            download(url);
            window.URL.revokeObjectURL(url);
          }
          xhr.send();
        }
      } // saveAs()

      const menu = {
        id: "saveas",
        label: `Save ${mediaType} As...`,
        sublabel: "",
        click: saveAs,
      }

      const showMenu = () =>
      {
        let mediaInputMenu = Menu.buildFromTemplate([menu]);
        mediaInputMenu.popup({
          x: params.x,
          y: params.y,
          window: win,
          callback: () => {
            (mediaInputMenu as unknown) = null; // Unsure if memory would leak without this (Clean up, clean up, everybody do your share)
            if (!menuIsClosing)
            {
              (overlay.firstChild as HTMLElement)?.click();
              observer.disconnect();
              setTimeout(()=>document.body.classList.toggle("hiddenOverlay", false), 300);
              clearTimeout(timer);
            }
            menuIsClosing = false;
          },
        });
        return mediaInputMenu;
      } // showMenu()

      const urlLoaded = (src:string, sublabel:string="") =>
      {
        clearTimeout(timer);
        if (src)
          url = src;

        // cache new url for both old and new urls, it's probably redundent, since new url will be "attached" to the preview image
        cacheURL.set(params.srcURL, src);
        cacheURL.set(url, src);
        menu.sublabel = sublabel;
        menuIsClosing = true;
        // electron currently doesn't support dynamic menus, we have to re-open it
        mediaInputMenu.closePopup(win);
        mediaInputMenu = showMenu();
      } // urlLoaded()

      const observer:any = new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
      {
        const node = m[0].target as HTMLElement;
        let src:string;
        if (m[0].type == "attributes" && node.tagName == "IMG")
        {
          // image finished loading
          src = node.getAttribute("src") as string;
          o.disconnect();
        }
        else
        {
          const overlayImg = overlay.querySelector("img") as HTMLElement;
          if (!overlayImg)
            return;

          // image found in the overlay
          o.disconnect();
          src = overlayImg.getAttribute("src") as string;
          if (!src || src == url)
          {
            clearTimeout(timer);
            // wait 5sec for the image to load
            timer = setTimeout(function()
            {
              // change menu label
              urlLoaded("", "still loading...");
              // wait another 5sec and assume this is the original image
              timer = setTimeout(function()
              {
                urlLoaded(url, "");
              }, 5000);
            }, 5000);
            // wait for original image to load
            return observer.observe(overlayImg,
            {
              attributes: true,
              attributeFilter: ["src"]
            })
          }
        }
        // image finished loading
        urlLoaded(src);
        return;
      }) //observer

      const win = remote.getCurrentWindow();
      const img = document.elementFromPoint(params.x, params.y) as HTMLImageElement;
      const overlay = document.querySelector("body > div.cdk-overlay-container") as HTMLElement;
      const cachedUrl = cacheURL.get(url);
      let timer:any,
          enabled = true;

      if (cachedUrl)
        url = cachedUrl;

      if (img.classList.contains("image-msg") && !cachedUrl && (img.naturalWidth == 600 || img.naturalHeight == 600) )
      {
        // menu requested on image preview, let's load the original image
        enabled = false;
        document.body.classList.toggle("hiddenOverlay", true);
        observer.observe(overlay,
        {
          subtree: true,
          childList: true,
        });
        // open original image
        img?.click();
      }
      if (!enabled)
        menu.sublabel = "loading orig...";

      let mediaInputMenu = showMenu();
      break;
    default:
      if (params.isEditable) {
        const textMenuTemplateCopy = [...textMenuTemplate];
        if (params.misspelledWord) {
          textMenuTemplateCopy.unshift({ type: "separator" });
          textMenuTemplateCopy.unshift({
            label: "Add to Dictionary",
            click: () =>
              app.mainWindow?.webContents.session.addWordToSpellCheckerDictionary(
                params.misspelledWord
              ),
          });
          textMenuTemplateCopy.unshift({ type: "separator" });
          for (const suggestion of params.dictionarySuggestions.reverse()) {
            textMenuTemplateCopy.unshift({
              label: suggestion,
              click: () =>
                remote.getCurrentWebContents().replaceMisspelling(suggestion),
            });
          }
        }
        const textInputMenu = Menu.buildFromTemplate(textMenuTemplateCopy);
        textInputMenu.popup();
      } else {
        // Omit options pertaining to input fields if this isn't one
        let menu:any = [...standardMenuTemplate];
        const node = document.elementFromPoint(params.x, params.y) as HTMLElement;
        const msgNode = findMsg(node) as HTMLElement;
        if (!msgNode)
          return;

        const sel = document.getSelection() as Selection;
        let text:string = "";
        if (sel.containsNode(msgNode, true))
          text = sel.toString();

        if (text == "")
        {
          text = msgNode?.textContent as string;
          const range = document.createRange();
          range.selectNode(msgNode);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          text = window.getSelection()?.toString() as string;
          window.getSelection()?.removeAllRanges();
        }

        menu[0].click = () =>
        {
          if (text != "")
            clipboard.writeText(text);
        }

        menu[1].click = () =>
        {
          clipboard.writeText(params.linkURL);
        };

        menu[3].click = () =>
        {
          const range = document.createRange();
          range.selectNode(msgNode);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
        menu[0].enabled = text != ""
        if (!params.linkURL || node.tagName != "A")
        {
          menu.splice(1, 1);
        }
        const standardInputMenu = Menu.buildFromTemplate(menu);
        standardInputMenu.popup();
      }
  }
};
