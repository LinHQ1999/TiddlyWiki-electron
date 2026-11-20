import { dialog, Menu, Notification, shell, type MenuItemConstructorOptions, type MenuItem } from "electron";
import { basename } from "path";
import { pathExists } from "fs-extra";
import { config } from "./config";
import { Wiki } from "./wiki";
import { handlePathErr } from "./utils";
import { BrowserWindow, type BaseWindow } from "electron/main";
import ElectronLog from "electron-log";

export type MenuWindow = BaseWindow | undefined

async function openWiki(dir: string) {
  try {
    // 不加 await 则捕获不到错误！
    await Wiki.bootstrap(dir)
  } catch (e) {
    handlePathErr(e)
  }
}

async function buildRecentSubmenu(): Promise<MenuItemConstructorOptions[]> {
  const existing: string[] = []
  for (const dir of config.Recent) {
    if (await pathExists(dir)) existing.push(dir)
  }
  const items: MenuItemConstructorOptions[] = existing.map((dir) => ({
    label: basename(dir),
    toolTip: dir,
    click: () => openWiki(dir)
  }))
  if (items.length === 0) items.push({ label: "（无记录）", enabled: false })
  items.push({ type: "separator" }, {
    label: "清空最近记录",
    click() {
      config.clearRecent()
      refreshMenu()
    },
  })
  return items
}

function buildBaseMenu(): Array<MenuItemConstructorOptions> {
  return [
  {
    label: "文件",
    submenu: [
      {
        label: "打开目录",
        accelerator: "Ctrl+O",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (!win) return
          try {
            const selected = await dialog.showOpenDialog(win, {
              properties: ["openDirectory"],
            });
            if (selected.filePaths.length === 1) {
              await openWiki(selected.filePaths[0])
            }
          } catch (e) {
            handlePathErr(e)
          }
        },
      },
      {
        label: "重载服务",
        accelerator: "Ctrl+Shift+R",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (!win) return
          const wiki = Wiki.byWindow(win);
          if (wiki) {
            wiki.restart();
          }
        },
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "浏览",
    submenu: [
      {
        label: "浏览器中打开",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (!win) return
          const single = Wiki.byWindow(win)?.wkType;
          if (single && single.isSingle) {
            new Notification({
              title: "仅供预览",
              body: "默认情况下单文件版不支持编辑",
            }).show();
            await shell.openPath(single.path);
          } else {
            await shell.openPath((<BrowserWindow>win).webContents.getURL());
          }
          win.minimize();
        },
      },
      {
        label: "页面内部搜索",
        accelerator: "Ctrl+F",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (win) Wiki.byWindow(win)?.searchToggle(true)
        },
      },
      {
        label: "打开所在位置",
        accelerator: "Ctrl+Shift+O",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (!win) return
          const wiki = Wiki.byWindow(win);
          if (wiki) {
            shell.openPath(wiki.dir);
          }
        },
      },
      { type: "separator" },
      {
        label: "打开应用日志",
        async click() {
          shell.openPath(ElectronLog.transports.file.getFile().path)
        }
      },
      {
        label: "开发者工具",
        accelerator: "Ctrl+Alt+Shift+F12",
        async click(
          _: MenuItem,
          win: MenuWindow,
        ) {
          if (!win) return
          (<BrowserWindow>win).webContents.openDevTools();
        },
      },
      { role: "reload" },
    ],
  },
  ]
}

const darwinMenu: Array<MenuItemConstructorOptions> = [
  {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' }
    ]
  },
  {
    label: '窗口',
    submenu: [
      { role: 'minimize' },
      { role: 'togglefullscreen' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'unhide' },
      { role: 'hideOthers' },
      { type: 'separator' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
    ]
  }
]

/**
 * 菜单无法惰性生成，bootstrap 后整体重建
 */
export async function refreshMenu() {
  const template = buildBaseMenu()
  const recent = await buildRecentSubmenu()
  const fileSubmenu = template[0].submenu as MenuItemConstructorOptions[]
  fileSubmenu.splice(1, 0, { label: "最近打开", submenu: recent })
  if (config.env.os.includes('darwin')) template.push(...darwinMenu)
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function initMenu() {
  return refreshMenu()
}
