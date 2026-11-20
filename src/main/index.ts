import { app, BrowserWindow, dialog } from "electron";
import log, { debug, info, error as err, warn } from "electron-log";
import { pathExists } from "fs-extra";
import { InitAPI } from "./api";
import { config } from "./config";
import { initMenu } from "./menu";
import { TWService } from "./services";
import { Wiki } from "./wiki";
import { handlePathErr } from "./utils";
import { applyLinuxFlags } from "./flags";
import { env } from "process";
import isDev from "electron-is-dev";

async function loadWiki() {
  try {
    if (app.requestSingleInstanceLock()) {
      await app.whenReady()
      debug('appReady')
      // 优先恢复上次聚焦的目录，失效后再从 recent 列表中取第一条仍存在的
      let lastOpen: string | undefined
      const lastFocused = config.LastFocused
      if (lastFocused && await pathExists(lastFocused)) {
        lastOpen = lastFocused
      } else {
        for (const dir of config.Recent) {
          if (await pathExists(dir)) {
            lastOpen = dir
            break
          }
        }
      }
      // 列表为空或全部失效时弹打开对话框
      if (lastOpen === undefined) {
        const win = Wiki.createWindow();

        // 这里允许重选
        while (true) {
          const selected = await dialog.showOpenDialog(win, { properties: ["openDirectory"] })
          const paths = selected.filePaths;
          if (paths.length === 1 && !selected.canceled) {
            try {
              await Wiki.bootstrap(paths[0], win);
              break
            } catch (e) {
              handlePathErr(e)
            }
          } else {
            info("用户手动取消操作")
            app.quit()
            break
          }
        }
      } else {
        await Wiki.bootstrap(lastOpen)
      }
    } else {
      warn("不允许多实例");
      app.quit();
    }
  } catch (reason) {
    err(reason);
    app.quit();
  }
}

(async () => {
  log.transports.file.level = (env.DEBUG || isDev) ? 'debug' : 'warn'

  // 必须在 app ready 前追加 Linux 下的硬件加速和输入法参数
  applyLinuxFlags();

  debug('应用启动')

  /**
   * 初始化菜单
   */
  initMenu();

  /**
   * 响应暴露的 api，需要安装 TDPlugins 插件
   */
  InitAPI();

  debug('菜单和 API 初始化完成')

  loadWiki()

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      loadWiki()
    }
  });

  app.on("window-all-closed", function () {
    TWService.stopAll();
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
})()
