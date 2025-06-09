import { dialog, Menu, Notification, shell } from "electron";
import { config } from "./config";
import { Wiki } from "./wiki";
import { handlePathErr } from "./utils";
import { BrowserWindow } from "electron/main";
import ElectronLog from "electron-log";

export const MenuTmpl = [
  {
    label: "文件",
    submenu: [
      {
        label: "打开目录",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          try {
            const selected = await dialog.showOpenDialog(win, {
              properties: ["openDirectory"],
            });
            if (selected.filePaths.length === 1) {
              // 不加 await 则捕获不到错误！
              await Wiki.bootstrap(selected.filePaths[0])
            }
          } catch (e) {
            handlePathErr(e)
          }
        },
      },
      {
        label: "重载服务",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          const wiki = Wiki.byWindow(win);
          if (wiki) {
            wiki.restart();
          }
        },
      },
      {
        label: "设为默认",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          const wiki = Wiki.byWindow(win);
          if (wiki) {
            config.Opened = wiki.dir;
          }
        },
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
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
    label: "浏览",
    submenu: [
      {
        label: "浏览器中打开",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          const single = Wiki.byWindow(win)?.wkType;
          if (single && single.isSingle) {
            new Notification({
              title: "仅供预览",
              body: "默认情况下单文件版不支持编辑",
            }).show();
            await shell.openPath(single.path);
          } else {
            await shell.openPath(win.webContents.getURL());
          }
          win.minimize();
        },
      },
      {
        label: "页面内部搜索",
        accelerator: "Ctrl+F",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          Wiki.byWindow(win)?.searchToggle(true)
        },
      },
      {
        label: "打开所在位置",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event,
        ) {
          const wiki = Wiki.byWindow(win);
          if (wiki) {
            shell.openPath(wiki.dir);
          }
        },
      },
      { type: "separator" },
      {
        label: "打开应用日志",
        async click(
          _: any,
          win: BrowserWindow,
          _event: Electron.Event
        ) {
          shell.openPath(ElectronLog.transports.file.getFile().path)
        }
      },
      {
        label: "开发者工具",
        accelerator: "Ctrl+Alt+Shift+F12",
        async click(
          _: any,
          win: Electron.BrowserWindow,
          _event: Electron.Event
        ) {
          win.webContents.openDevTools();
        },
      },
      { role: "reload" },
    ],
  },
];

export function initMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(<any>MenuTmpl));
}
