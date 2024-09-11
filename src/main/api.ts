import {
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

/**
 * 初始化所有的 preload 中的操作
 * 接收的所有文件名都不包括 files，只有文件名
 */
export function InitAPI() {
  /* ipcMain.handle("search:exec", (_, text: string, mode: number) => {
    const current = Wiki.current?.win.webContents ?? null;
    if (current) {
      switch (mode) {
        case -1:
          current.findInPage(text, { forward: false });
          break;
        case 0:
          current.stopFindInPage("clearSelection");
          break;
        case 1:
          current.findInPage(text, { forward: true });
          break;
        default:
          current.findInPage(text);
      }
    }
  }); */

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
    writeFile(abspath, text, { encoding: "UTF-8" });
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
}
