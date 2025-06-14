import {
  BrowserWindow,
  FindInPageOptions,
  ipcMain,
  IpcMainEvent,
} from "electron";
import {
  copyFileSync,
  writeFile,
  writeFileSync,
} from "fs-extra";

import { FileInfo } from "./preloads/main";
import { Wiki } from "./wiki";

export interface ISearchRes {
  requestId: number,
  activeMatchOrdinal: number,
  matches: number,
  finalUpdate: boolean
}

export interface ISearchOpts {
  text: string,
  cancel: boolean,
  opts: FindInPageOptions
}

/**
 * 初始化所有的 preload 中的操作
 * 接收的所有文件名都不包括 files，只有文件名
 */
export function InitAPI() {
  /**
   * [实验性] 可能存在序列化和反序列化，大文件可能严重影响程序性能！
   */

  /**
   * 将内嵌的 tiddler 转换为 external
   */
  ipcMain.handle("convert", ({ sender }, file: string, fname: string) => {
    Wiki.bySender(sender)?.convertAttachment(file, fname)
  });

  /**
   * 处理 file.path 为空的文件的导入行为
   */
  ipcMain.handle("download", ({ sender }, file: ArrayBuffer, fname: string) => {
    Wiki.bySender(sender)?.downloadAttachment(file, fname)
  });

  /**
   * 以复制的方式导入文件
   */
  ipcMain.handle("import", ({ sender }, file: FileInfo) => {
    Wiki.bySender(sender)?.importAttachment(file)
  });

  /**
   * 文件对比回收
   * fname: ./files/foo.bar
   */
  ipcMain.handle("gc", ({ sender }, fnames: string[]) => {
    Wiki.bySender(sender)?.cleanAttachments(fnames)
  });

  /**
   * path: ./files/foo.bar
   */
  ipcMain.handle("delete", ({ sender }, path: string) => {
    Wiki.bySender(sender)?.deleteAttachment(path)
  });

  /**
   * 进行原生保存
   */
  ipcMain.handle("save", (_, abspath: string, text: string) => {
    copyFileSync(abspath, abspath + ".old");
    writeFile(abspath, text, { encoding: "utf-8" });
    return true;
  });
  ipcMain.on("savesync", (ev: IpcMainEvent, abspath: string, text: string) => {
    try {
      copyFileSync(abspath, abspath + ".old");
      writeFileSync(abspath, text);
      ev.returnValue = true;
    } catch (error) {
      ev.returnValue = false;
      throw error;
    }
  });

  /**
   * 劫持默认的 window.confirm 和 alert
   */
  ipcMain.on("confirm", (ev: IpcMainEvent, msg: string) => {
    ev.returnValue = Wiki.bySender(ev.sender)?.confirm(msg) == 0;
  });
  ipcMain.on("alert", (ev: IpcMainEvent, msg: string) => {
    ev.returnValue = Wiki.bySender(ev.sender)?.alert(msg) == 0;
  });

  /**
   * 页面内搜索，代偿浏览器
   */
  ipcMain.on('search', (ev: IpcMainEvent, action: ISearchOpts) => {
    Wiki.byWindow(BrowserWindow.fromWebContents(ev.sender)?.getParentWindow() as BrowserWindow)?.search(action)
  })
}
