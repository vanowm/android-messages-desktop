import {remote, NativeImage, nativeImage} from "electron";
import path from "path";
import settings from "electron-settings";
import {
  RESOURCES_PATH,
  IS_WINDOWS,
  IS_LINUX,
  IS_MAC,
  DEFAULT_BADGE_POSITION,
  DEFAULT_BADGE_SCALE,
  DEFAULT_BADGE_TASKBAR
} from "./constants";

const {app} = remote;

export class UnreadManager {
	private timer:any;
	private prevUnread:any = {list:[]};
  private iconCache: Map<string, NativeImage> = new Map();
  private iconCacheName:string = "unreadIcon";

	// check if a node or it's parent matches filter
	private isParent(node:any, filter:any):any
	{
	  if (!node)
	    return false;

	  if (node.nodeType == 3)
	    return this.isParent(node.parentNode, filter);

	  for (let i = 0; i < filter.length; i++)
	  {
	    switch(filter[i][0])
	    {
	      case "tagName":
	        if (node[filter[i][0]] == filter[i][1])
	          return node;
	        break;
	      case "class":
	        if (node.classList?.contains(filter[i][1]))
	          return node;
	        break;
	      default:
	        if (node.getAttribute && node.getAttribute(filter[i][0]) == filter[i][1])
	          return node;
	    }
	  }

	  return this.isParent(node.parentNode, filter);
	}

	//app.mainWindow?.isFocused() is unreliable
	public isFocused(f?:boolean):boolean
	{
		if (f !== undefined)
		{
			document?.body?.setAttribute("focus", f ? "true" : "");
		  document?.body?.setAttribute("changeicon", "");
		}

		return document?.body?.getAttribute("focus") == "true" && app.mainWindow?.isFocused() as boolean;
	}

	public generateIcon(opt:any, callback:Function): void
	{
	  const canvIcon = document.createElement("canvas"),
	        ctxIcon:any = canvIcon.getContext("2d"),
	        canvText = document.createElement("canvas"),
	        ctxText:any = canvText.getContext("2d"),
	        img:any = new Image(),
	        text = opt.text || "",
	        iconSize = opt.iconSize || 32,
	        textSize = opt.textSize || iconSize,
	        textScale = opt.textScale !== undefined ? opt.textScale                   : settings.get("iconBadgeScale", DEFAULT_BADGE_SCALE) as number,
	        textPosition = opt.textPosition !== undefined ? opt.textPosition          : settings.get("iconBadgePosition", DEFAULT_BADGE_POSITION) as number,
	        textColor = opt.textColor !== undefined ? opt.textColor                   : "white",
	        outlineOut = opt.outlineOut !== undefined ? opt.outlineOut                : Math.round(iconSize/5.333 + (textScale < 1 ? -(textScale * 2) : textScale)),
	        outlineOutColor = opt.outlineOutColor !== undefined ? opt.outlineOutColor : "red",
	        outlineIn = opt.outlineIn !== undefined ? opt.outlineIn                   : textScale * 2,
	        outlineInColor = opt.outlineInColor !== undefined ? opt.outlineInColor    : "black",
	        font = opt.font !== undefined ? opt.font                                  : "Verdana",
	        offsetX = opt.offsetX !== undefined ? opt.offsetX                         : 0,
	        offsetY = opt.offsetY !== undefined ? opt.offsetY                         : 0,
	        fontSize = (textSize - outlineOut * 2) * textScale;

	  canvIcon.width = iconSize;
	  canvIcon.height = iconSize;
	  canvText.width = iconSize;
	  canvText.height = iconSize;

	  let x = canvText.width / 2,
	      y = x;

	  ctxText.font = fontSize + 'px "' + font + '"';
	  ctxText.lineJoin = "round";
	  ctxText.textAlign = "center";
	  ctxText.textBaseline = "middle";
	  ctxText.miterLimit = 2;
	  ctxText.globalAlpha = 1;

	  ctxText.strokeStyle = outlineOutColor;    // outer outline
	  ctxText.lineWidth = outlineOut;
	  ctxText.strokeText(text, x, y);

	  ctxText.strokeStyle = outlineInColor;     // inner outline
	  ctxText.lineWidth = outlineIn;
	  ctxText.strokeText(text, x, y);

	  ctxText.fillStyle = textColor;            // text
	  for(let i = 0; i < 5; i++)
	  {
	    if (!i)
	    {
	      ctxText.save();
	      ctxText.globalAlpha = 0.3;
	      ctxText.fillText(text, x, y+1);
	      ctxText.fillText(text, x, y-1);
	      ctxText.globalAlpha = 1;
	      ctxText.restore();
	    }
	    ctxText.fillText(text, x, y);
	  }

	// find boundaries of the text
	  let w = canvText.width,
	      h = canvText.height,
	      data = new Uint32Array(ctxText.getImageData(0, 0, w, h).data.buffer),
	      len = data.length,
	      y1 = 0, y2 = 0, x1 = w, x2 = 0;

	  x = y = 0;

	  // y1
	  for(y = 0; y < h; y++)
	  {
	    for(x = 0; x < w; x++)
	    {
	      if (data[y * w + x])
	      {
	        y1 = y;
	        y = h;
	        break;
	      }
	    }
	  }

	  // y2
	  for(y = h - 1; y > y1; y--)
	  {
	    for(x = 0; x < w; x++)
	    {
	      if (data[y * w + x] & 0x80000000)
	      {
	        y2 = y;
	        y = 0;
	        break;
	      }
	    }
	  }

	  // x1
	  for(y = y1; y < y2; y++)
	  {
	    for(x = 0; x < w; x++)
	    {
	      if (x < x1 && data[y * w + x] & 0x80000000)
	      {
	        x1 = x;
	        break;
	      }
	    }
	  }

	  // x2
	  for(y = y1; y < y2; y++)
	  {
	    for(x = w - 1; x > x1; x--)
	    {
	      if (x > x2 && data[y * w + x] & 0x80000000)
	      {
	        x2 = x;
	        break;
	      }
	    }
	  }

	  const tx = x1,
	        ty = y1,
	        tw = x2 - x1 + 1,
	        th = y2 - y1 + 1;

	  x = y = 0;
	  switch(textPosition)
	  {
	    case 0:                             // 0: top left
	      break;
	    case 1:                             // 1: top right
	    default:
	      x = canvIcon.width - tw;
	      break;
	    case 2:                             // 2: bottom right
	      x = canvIcon.width - tw;
	      y = canvIcon.height - th;
	      break;
	    case 3:                             // 3: bottom left
	      y = canvIcon.height - th;
	      break;
	    case 4:                             // 4: center
	      x = (canvIcon.width - tw) / 2;
	      y = (canvIcon.height - th) / 2;
	      break;
	  }

	  img.onload = () => // background image
	  {
	    ctxIcon.drawImage(img, 0, 0, iconSize, iconSize); // append background to the icon
	    ctxIcon.drawImage(canvText, tx, ty, tw, th, x + offsetX, y + offsetY, tw,th); // append text to the icon
	    opt.icon = nativeImage.createFromDataURL(canvIcon.toDataURL());
	    callback(opt);
	  }
	  img.src = nativeImage.createFromPath(this.getIcon(iconSize) || app.trayManager?.iconPath || "").toDataURL();
	}// generateIcon();

	public get observer ()
	{
		return (mutationList?: MutationRecord[], observer?: MutationObserver) => this._observer(mutationList, observer);
	}

	private _observer (_mutationList?: MutationRecord[], _observer?: MutationObserver)
	{
    if (_mutationList)
    {
      let found = false,
          node:any;

      for(let i = 0; i < _mutationList.length; i++)
      {
        node = _mutationList[i].target;
        if (node.tagName == "MWS-CONVERSATION-LIST-ITEM"
            || this.isParent(node, [
                                ["tagName", "CANVAS"],
                                ["tagName", "MWS-RELATIVE-TIMESTAMP"],
                                ["tagName", "MWS-CONVERSATION-LIST-ITEM-MENU"],
                                ["class", "menu-button"]
                              ]))
        {
          continue
        }
        if (found = this.isParent(node, [["tagName", "MWS-CONVERSATION-LIST-ITEM"]])
            || this.isParent(node, [["changeicon", ""]])) //we can trigger reload icon by adding "changeicon" attribute to BODY
          break;
      }
      if (!found)
        return;

      // for performance improvement wait for the rest of mutation events
      clearTimeout(this.timer);
      this.timer = setTimeout(this._observer.bind(this), 100);
      return;
    }
    const changeIcon = document.body.hasAttribute("changeicon");
    if (!changeIcon && document.querySelector("mw-settings-container"))
      return;
    clearTimeout(this.timer);
    let unread:any = {icon:"",list:[]};

    if (changeIcon)
    {
      unread = this.prevUnread;
      unread.changeIcon = true;
      document.body.removeAttribute("changeicon");
    }
    else
    {
      let isNew:boolean = false;
      // collect some info about new messages, this could be used to display custom formatted tooltip
      for(let i = 0, node, data:any, name, avatar:HTMLCanvasElement|null, text, nodes = document.querySelectorAll("[data-e2e-is-unread=true]"); i < nodes.length; i++)
      {
        node = nodes[i];
        unread.list[unread.list.length] = data = {};
        if (name = node.querySelector("[data-e2e-conversation-name]"))
          data.name = name.textContent;

        // not using cache, because this might fire very early at startup when avatar is not loaded yet which might cache a placeholder instead.
        if (avatar = node.querySelector("canvas.canvas-avatar"))
          data.avatar = avatar.toDataURL();

        if (text = node.querySelector("div.snippet-text.ng-star-inserted"))
          data.text = text.textContent;

        let n = unread.list.length - 1;
        if (!this.prevUnread.list[n] || this.prevUnread.list[n].name != data.name || this.prevUnread.list[n].avatar != data.avatar || this.prevUnread.list[n].text != data.text)
          isNew = true;

      }

      if (!changeIcon && !isNew && !this.prevUnread.list)
        return;

      this.prevUnread = unread;
    }

    const text = unread.list.length,
          // badge position: 0=top-left; 1=top-right; 2=bottom-right; 3=bottom-left; 4=center
          textPosition:number = settings.get("iconBadgePosition", DEFAULT_BADGE_POSITION) as number,
          textScale = settings.get("iconBadgeScale", DEFAULT_BADGE_SCALE) as number, // badge scale: 0.5 - 1.5
          iconSizes:any = {
            "":   {outlineOut: 7, outlineIn: 4}, //32x32 icon to use as 16x16 (tray)
//    				"16":	{textScale: (textScale + textScale / 10), outlineOut: 4, outlineIn: 3}, //16x16 //doesn't look good
//    				"24":	{textScale: textScale, outlineIn: 3}, //24x24
//            "32": {textScale: (textScale - textScale / 2.4), outlineIn: 3}, //32x32 with small badge
//    				"48":	{textScale: (textScale - textScale / 2.4), outlineIn: 3}, //48x48
//            "64": {textScale: (textScale - textScale / 2), outlineOut: 9, outlineIn: 4}, //64x64 used on Windows taskbar
//    				"128":	{textScale: (textScale - textScale / 2), outlineOut: 16, outlineIn: 6}, //128x128
//    				"256":	{textScale: (textScale - textScale / 2), outlineOut: 26, outlineIn: 8}, //256x256
          },
          unreadID = text + "_" + textPosition + "_" + textScale;

    if (IS_WINDOWS)
    {
      iconSizes["64"] = {textScale: (textScale - textScale / 2), outlineOut: 9, outlineIn: 4}; //64x64 used on Windows taskbar
    }

    for (let i in iconSizes)
    {
      // load cached icons
      unread["icon" + i] = this.unreadIconImage(unreadID + "_" + i);
    }
		unread.focus = this.isFocused();
    if (unread.icon)
    {
      // re-use cached icons
      app.trayManager?.setUnreadIcon(unread);
    }
    else
    {
      // generate new icons
      let count = Object.keys(iconSizes).length;
      const callback = (opt:any):void =>
      {
        if (--count)
          return;

        for(let i in iconSizes)
        {
          unread["icon" + i] = iconSizes[i].icon;
          this.unreadIconImage(unreadID + "_" + i, iconSizes[i].icon); // cache new icon
        }
        app.trayManager?.setUnreadIcon(unread); // change tray icon
      };

      for(let i in iconSizes)
      {
        iconSizes[i].iconSize = i;
        iconSizes[i].text = text;
        this.generateIcon(iconSizes[i], callback);
      }
    }
	} //observer()

  private getIcon(size:number): string
  {
    if (IS_MAC)
      return path.resolve(RESOURCES_PATH, "tray", "icon_macTemplate.png")

    return path.resolve(RESOURCES_PATH, "icons", size + "x" + size + ".png");
  }

  private unreadIconImage(text:string, icon?:NativeImage): NativeImage | undefined
  {
    const iconCacheName = this.iconCacheName + text;
    if (icon !== undefined)
      return this.iconCache.set(iconCacheName, icon), undefined;

    if (this.iconCache.has(iconCacheName))
      return this.iconCache.get(iconCacheName);

    return undefined;
  }

}
