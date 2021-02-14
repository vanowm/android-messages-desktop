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

const standardMenuTemplate: MenuItemConstructorOptions[] =
[
  {
    label: "Save # As...",
    id: "SAVEAS"
  },
  {
    type: "separator",
    id: "SEPSAVEAS"
  },
  {
    label: "Copy Link",
    id: "COPYL"
  },
  {
    label: "Copy Message",
    id: "COPY"
  },
  {
    type: "separator",
    id: "SEP2"
  },
  {
    label: "Select All",
    id: "SELALL"
  }
];

const textMenuTemplate: MenuItemConstructorOptions[] =
[
  {
    label: "Undo",
    role: "undo",
    id: "UNDO"
  },
  {
    label: "Redo",
    role: "redo",
    id: "REDO"
  },
  {
    type: "separator",
  },
  {
    label: "Cut",
    role: "cut",
    id: "CUT"
  },
  {
    label: "Copy",
    role: "copy",
    id: "COPY"
  },
  {
    label: "Paste",
    role: "paste",
    id: "PASTE"
  },
  {
    label: "Delete",
    role: "delete",
    id: "DELETE"
  },
  {
    type: "separator",
  },
  {
    label: "Select All",
    role: "selectAll",
    id: "SELALL"
  },
];

 //defining global variables for events when user closed previous menu by opening new one
let menu:any,
    overlayTimer!:NodeJS.Timer;
;
export const popupContextMenu = async (event: Electron.Event, params: ContextMenuParams): Promise<void> => {

  //get clicked on DOM element
  const node = document.elementFromPoint(params.x, params.y) as HTMLElement;
  const msgNode = findMsg(node) as HTMLElement;

  if (!msgNode && !params.isEditable)
    return;

  let callback:Function|null = null;

  const _callback = () =>
  {
    (menu as unknown) = null; // Unsure if memory would leak without this (Clean up, clean up, everybody do your share)
    if (typeof callback == "function")
      callback();
  }
  const isLightbox = msgNode && msgNode.tagName == "MWS-LIGHTBOX";
  const win = remote.getCurrentWindow();

  const menuTemplate:MenuItemConstructorOptions[] = JSON.parse(JSON.stringify(params.isEditable ? textMenuTemplate : standardMenuTemplate)); //clone template
  const menuItem = (id:string):any =>
  {
    for(let i = 0; i < menuTemplate.length; i++)
    {
      if (menuTemplate[i].id == id)
        return menuTemplate[i] as {};
    }
    return {};
  }
  const menuItemIndex = (id:string):number =>
  {
    for(let i = 0; i < menuTemplate.length; i++)
    {
      if (menuTemplate[i].id == id)
        return i;
    }
    return -1;
  }
  const showMenu = (callback?:Function|null) =>
  {
    menu?.off("menu-will-close", _callback);
    menu = Menu.buildFromTemplate(menuTemplate);
    menu.on("menu-will-close", _callback);
    menu.popup({
      x: params.x,
      y: params.y,
      window: win,
    });
  } // showMenu()

  if (params.isEditable) {
    menuItem("UNDO").enabled = params.editFlags.canUndo;
    menuItem("REDO").enabled = params.editFlags.canRedo;
    menuItem("SELALL").enabled = params.editFlags.canSelectAll;
    menuItem("COPY").enabled = params.editFlags.canCopy;
    menuItem("CUT").enabled = params.editFlags.canCut;
    menuItem("PASTE").enabled = params.editFlags.canPaste;
    menuItem("DELETE").enabled = params.editFlags.canDelete;

    if (params.misspelledWord) {
      menuTemplate.unshift({ type: "separator" });
      menuTemplate.unshift({
        label: "Add to Dictionary",
        click: () =>
          app.mainWindow?.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord
          ),
      });
      menuTemplate.unshift({ type: "separator" });
      for (const suggestion of params.dictionarySuggestions.reverse()) {
        menuTemplate.unshift({
          label: suggestion,
          click: () =>
            remote.getCurrentWebContents().replaceMisspelling(suggestion),
        });
      }
    }
    showMenu();
    return;
  }

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
  else
  {
    menuItem("COPY").label = "Copy";
  }

  menuItem("COPY").click = () =>
  {
    if (text != "")
      clipboard.writeText(text);
  }

  menuItem("COPYL").click = () =>
  {
    clipboard.writeText(params.linkURL);
  };

  menuItem("SELALL").click = () =>
  {
    const range = document.createRange();
    range.selectNode(msgNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }
  menuItem("COPY").enabled = msgNode.textContent?.trim() != "" && !isLightbox;
  menuItem("SELALL").enabled = msgNode.textContent?.trim() != "" && !isLightbox;
  menuItem("COPYL").visible = (params.linkURL && node.tagName == "A") as boolean;

  switch (params.mediaType) {
    case "video":
    case "image":
      if (!params.srcURL || !params.srcURL.length)
        break;

      const mediaType = params.mediaType[0].toUpperCase() + params.mediaType.slice(1);

      let url = params.srcURL;

      menuTemplate.splice(menuItemIndex("COPYL"), 1); // remove copy link
      menuItem("SAVEAS").visible = true;
      menuItem("SAVEASSEP").visible = true;
      menuItem("SAVEAS").label = menuItem("SAVEAS").label?.replace("#", mediaType);
      menuItem("SAVEAS").click = () =>
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
      } // saveAs.click()

      callback = () =>
      {
        observer.disconnect();
        clearTimeout(timer);
        (overlay.firstChild as HTMLElement)?.click();
        overlayTimer = setTimeout(()=> document.body.classList.toggle("hiddenOverlay", false), 300);
      }

      const urlLoaded = (src:string, sublabel:string="") =>
      {
        clearTimeout(timer);
        if (src)
          url = src;

        // cache new url for both old and new urls, it's probably redundent, since new url will be "attached" to the preview image
        cacheURL.set(params.srcURL, src);
        cacheURL.set(url, src);
        menuItem("SAVEAS").sublabel = sublabel;
        menu.off("menu-will-close", _callback)
        // electron currently doesn't support dynamic menus, we have to re-open it
        menu.closePopup(win);
        if (sublabel == "" && typeof callback == "function")
          callback();

        showMenu(callback);
      } // urlLoaded()

      const observer:MutationObserver = new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
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
              // wait another 10sec and assume this is the original image
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

      let overlay = {} as HTMLElement;
      const win = remote.getCurrentWindow();
      const cachedUrl = cacheURL.get(url);
      let timer:NodeJS.Timer,
          enabled = true;

      if (cachedUrl)
        url = cachedUrl;

      const img = node as HTMLImageElement;
      if (node.classList.contains("image-msg") && !cachedUrl && (img.naturalWidth == 600
                                                                  || img.naturalHeight == 600
                                                                  || (img.naturalWidth == 400 && img.naturalHeight < img.naturalWidth)))
      {
        // menu requested on image preview, let's load the original image
        enabled = false;
        clearTimeout(overlayTimer);
        setTimeout(()=>clearTimeout(overlayTimer), 10);
        document.body.classList.toggle("hiddenOverlay", true);
        // lightbox
        for (let i = 0; i < 100; i++)
        {
          if (overlay = document.querySelector("body > div.cdk-overlay-container") as HTMLElement)
            break;

          const button = document.querySelector("mw-main-nav-menu > button") as HTMLElement;
          button.click();
          button.click();
        }
        observer.observe(overlay,
        {
          subtree: true,
          childList: true,
        });
        // open original image
        node?.click();
      }
      if (!enabled)
        menuItem("SAVEAS").sublabel = "loading orig...";

      break;

    default:
      menuTemplate.splice(menuItemIndex("SAVEAS"), 1);
      menuTemplate.splice(menuItemIndex("SEPSAVEAS"), 1);
  } // switch(params.mediaType)
  showMenu(callback);
};

const cacheURL:Map<string, string> = new Map();
const findMsg = function (node:Element|Element|null):HTMLElement|null
{
  if (!node)
    return null;

  if (node.tagName == "MWS-MESSAGE-PART-CONTENT" || node.tagName == "MWS-LIGHTBOX")
    return node as HTMLElement;

  return findMsg(node.parentNode as Element );
}
