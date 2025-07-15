import { BrowserWindow, Notification, WebContents, dialog, shell } from "electron";
import electronIsDev from "electron-is-dev";
import { debug, warn, info } from "electron-log";
import { copyFile, ensureDir, move, pathExists, readJson, readdir, writeFile } from "fs-extra";
import { join, basename } from "path";
import { config } from "./config";
import { Service, TWService } from "./services";
import { FileInfo } from "./preloads/main";
import { ISearchOpts } from "./api";
import { PathErr } from "./utils";
import { type MenuWindow } from "./menu";

interface WikiInfo {
  isSingle: boolean;
  path: string;
}

/**
 * 直接依赖 services 进行服务管理
 *
 * 不要直接 new，调用 createWiki 新建对象
 */
export class Wiki {
  static wikis: Set<Wiki> = new Set();
  // 窗口聚焦则切换
  static current: Wiki | null = null;

  dir: string;
  // 单文件不需要后端服务
  service: Service | undefined;
  wkType: WikiInfo;
  win: BrowserWindow;
  searchWin: BrowserWindow | undefined;
  // 是否单文件版

  /**
   * 启动新 wiki 并打开新窗口
   *
   * @param dir 启动目录
   * @param window 是否使用已有的 BrowserWindow
   * @param port 起始端口，默认 11111
   */
  constructor(
    dir: string,
    window: BrowserWindow,
    wikiType: WikiInfo,
    service?: Service
  ) {
    this.dir = dir;
    this.wkType = wikiType;
    this.win = window
    this.service = service
    this.searchWin = undefined;

    // 防止误操作，始终绑定本身对象
    this.confWin.apply(this);
  }

  /**
   * 重启服务
   */
  async restart() {
    // 停止服务，但不要移除窗口
    if (!this.wkType.isSingle && this.service !== undefined) {
      TWService.stop(this.service);
      // 重启
      this.win.setTitle("正在重载服务……");
      this.service = await TWService.launch(
        this.dir,
        this.service.port,
        ...await Wiki.loadCfg(this.dir),
      );
      // 并刷新
      this.service.twInstance.stdout?.once("data", () => {
        this.win.reload();
        this.win.setTitle(this.win.webContents.getTitle());
      });
    } else {
      new Notification({
        title: "当前加载：单文件版",
        body: "单文件版不支持重载服务！",
      }).show();
    }
  }

  /**
   * 跟据 resized 和 moved 事件重新计算搜索窗口位置
   */
  moveSearchWin() {
    if (!this.searchWin) return

    const [px, py] = this.win.getPosition()
    const [pw] = this.win.getSize()
    const [cw] = this.searchWin.getSize()

    this.searchWin.setPosition(px + pw - cw - 50, py + 50, false)
  }

  /**
   * 执行页面内搜索
   */
  search(opt: ISearchOpts) {
    console.log(opt)
    if (opt.cancel || !opt.text) {
      this.searchToggle(false)
      this.win.webContents.stopFindInPage("clearSelection")
    } else {
      this.win.webContents.findInPage(opt.text, opt.opts)
    }
  }

  /**
   * 控制搜索窗口显示隐藏，懒加载实现
   */
  searchToggle(state: boolean) {
    if (!this.searchWin) {
      this.searchWin = new BrowserWindow({
        width: 340,
        height: 40,
        resizable: false,
        frame: false,
        show: false,

        parent: this.win,

        webPreferences: {
          preload: join(__dirname, "preloads", "search.js"),
        },
      })

      if (electronIsDev)
        this.searchWin.loadURL("http://127.0.0.1:5173")
      else
        this.searchWin.loadFile(join(__dirname, "static", "index.html"))
    }

    if (state) {
      this.moveSearchWin()
      this.searchWin.show()
    } else {
      this.searchWin?.hide()
      this.win.focus()
    }
  }

  /**
   * 将内嵌的 tiddler 转换为 external
   */
  async convertAttachment(file: string, fname: string) {
    const fpath = join(this.dir, 'files', fname)
    info(`附件转换请求：${this.dir} ${fpath}`)
    if (await pathExists(fpath)) {
      new Notification({
        title: "文件已存在",
        body: "考虑重命名文件",
      }).show();
    } else {
      writeFile(fpath, Buffer.from(file, "base64"));
    }
  }

  /**
   * 处理附件导入
   */
  async importAttachment(file: FileInfo) {
    if (file.path) {
      const destDIR = join(this.dir, "files");
      copyFile(file.path, join(destDIR, file.name));
      info(`附件导入请求：${join(destDIR, file.name)}`)
    } else {
      new Notification({
        title: "无法获取资源",
        body: "正在操作的文件已不存在",
      }).show();
    }
  }

  /**
   * 处理 tiddlywiki 自己下载下来的文件
   */
  async downloadAttachment(file: ArrayBuffer, fname: string) {
    writeFile(join(this.dir, 'files', fname), Buffer.from(file))
  }

  /**
   * 将指定路径的文件回收
   *
   * @param path 文件路径[./files/foo.bar]
   */
  async deleteAttachment(file: string) {
    const trash = join(this.dir, "files", ".trash")
    const fullpath = join(this.dir, file)
    await ensureDir(trash)
    if (await pathExists(fullpath)) {
      move(fullpath, join(trash, basename(fullpath)), { overwrite: true })
      info(`删除成功：${file}`)
    }
  }

  /**
   * 覆盖 Webcontents 中的 confirm
   */
  confirm(msg: string) {
    return dialog.showMessageBoxSync(
      this.win,
      {
        title: "等一下",
        buttons: ["当然", "不清楚"],
        cancelId: 1,
        defaultId: 1,
        message: msg,
      },
    );
  }

  alert(msg: string) {
    return dialog.showMessageBoxSync(this.win, {
      title: "注意",
      message: msg,
    });
  }

  /**
   * 删除不在 attachmentList 中的附件
   */
  async cleanAttachments(attachmentList: string[]): Promise<number> {
    const cwd = this.dir;
    // 去除 ./files/ 前缀
    const basenames = attachmentList.map((fname) => basename(fname));
    const resources = await readdir(join(cwd, "files"))
    let counter = 0;
    for (const resource of resources) {
      if (resource == ".trash") continue;
      if (!basenames.includes(resource)) {
        info(resource);
        this.deleteAttachment(join("files", resource));
        counter++;
      }
    }
    const note = new Notification({
      title: "清理完毕",
      body: `共处理 ${counter} 个项目。`,
    });
    note.show();
    const recycle = join(cwd, "files", ".trash");
    note.once("click", () => shell.openPath(recycle));
    return counter
  }

  /**
   * 读取额外的 listen 参数
   *
   * @returns 额外的 listen 参数
   */
  static async loadCfg(dir: string): Promise<string[]> {
    // 总是压缩
    const params: string[] = ["gzip=yes"];
    const file = join(dir, "launch.json");
    if (await pathExists(file)) {
      const cfg = await readJson(file);
      for (const [k, v] of Object.entries(cfg)) {
        const param = `${k}=${v}`;
        // 检查重复项
        if (!params.includes(param)) params.push(param);
      }
    }
    return params;
  }

  /**
   * 处理 win 操作相关事宜
   */
  confWin() {
    // 页面内的链接始终采用默认浏览器打开而不是新建一个窗口
    this.win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    this.win.webContents.on("will-prevent-unload", (event) => {
      const selected = dialog.showMessageBoxSync(this.win, {
        title: "等一下",
        buttons: ["去保存", "不管了"],
        cancelId: 0,
        defaultId: 0,
        message: "你似乎没有保存！",
      });
      // 0 是去保存
      if (selected !== 0) event.preventDefault();
    });

    // 自动调整搜索框位置，当心 this 问题
    // resize 会有大小变动的 bug
    this.win.on('resized', () => this.moveSearchWin())
    this.win.on('moved', () => this.moveSearchWin())
    // this.win.on('enter-full-screen', () => this.moveSearchWin())
    // this.win.on('leave-full-screen', () => this.moveSearchWin())

    this.win.webContents.on('found-in-page', (_, res) => {
      this.searchWin?.webContents.send('search:res', res)
    })

    // 关闭窗口之后也关闭服务（如果有）并移除窗口
    this.win.once("closed", () => {
      if (this.service) {
        TWService.stop(this.service);
        info(`${this.dir} 的服务已关闭!`);
      }
      Wiki.wikis.delete(this);
    });
  }

  // Factory pattern to avoid asynchronous constructor
  static async bootstrap(dir: string, bindWin?: BrowserWindow | undefined, port = 11111): Promise<Wiki> {
    debug('Wiki bootstrap')
    const wkType = await Wiki.getWikiType(dir)
    let service: Service | undefined = undefined

    const win: BrowserWindow = bindWin ? bindWin : Wiki.createWindow()
    debug('Window 已创建')

    // 获取 wiki 中的自定义 ico，只有 windows 才能够进行此设置
    // 同时只有 windows 才能自动关闭菜单
    if (config.env.os == "win32") {
      const icon = join(dir, "tiddlers", "$__favicon.ico");
      if (await pathExists(icon)) win.setIcon(icon);
    } else {
      win.setMenuBarVisibility(true);
      win.setAutoHideMenuBar(false);
    }

    // 在 await 前注册监听器
    win.webContents.once(
      "dom-ready",
      () =>
        electronIsDev && win.webContents.openDevTools({ mode: "detach" }),
    );

    if (wkType.isSingle) {
      await win.loadFile(wkType.path)
      win.setTitle(win.webContents.getTitle())
      debug(`${wkType.path} 已启动`)
    } else {
      // 启动 node 版
      service = await TWService.launch(dir, port, ...await this.loadCfg(dir));
      if (service.twInstance.stdout) {
        service.twInstance.stdout.once("data", async () => {
          debug(`${dir} tiddlywiki.js 启动成功`)
          try {
            await win.loadURL(`http://localhost:${service?.port}`);
            win.setTitle(win.webContents.getTitle());
          } catch (err) {
            warn(`重试载入内容 ${err}`)
            win.reload();
          }
        });
      }
    }

    // 防止视觉闪烁
    // this.win.once('ready-to-show', this.win.show)

    const wiki = new Wiki(dir, win, wkType, service)
    Wiki.wikis.add(wiki)
    debug('Wiki bootstrap done')
    return wiki
  }

  /**
   * 判断当前 dir 是否是单文件版的
   * @returns SingleInfo
   */
  static async getWikiType(dir: string): Promise<WikiInfo> {
    const files = await readdir(dir);
    for (const file of files) {
      // 采用绝对路径
      if (file.includes(".html")) {
        const attachmentDir = join(dir, "files");
        ensureDir(attachmentDir)
        return { path: join(dir, file), isSingle: true };
      }

      if (file === 'tiddlywiki.info') return { path: "", isSingle: false };
    }
    throw new PathErr('无效路径！', dir)
  }

  /**
   * 通过 BrowserWindow 匹配对应的 wiki 实例
   */
  static byWindow(win: MenuWindow): Wiki | null {
    if (!win) return null
    for (const wiki of this.wikis) {
      if (wiki.win.id == win.id) {
        return wiki;
      }
    }
    return null;
  }

  /**
   * 通过 WebContent 获取实例
   */
  static bySender(content: WebContents): Wiki | null {
    const win = BrowserWindow.fromWebContents(content)
    return win ? Wiki.byWindow(win) : null
  }

  /**
   * 创建一个空窗口
   *
   * @returns null
   */
  static createWindow(title = "等待服务启动", show = true, hidemenu = true) {
    return new BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: hidemenu,
      title: title,
      show: show,
      webPreferences: {
        preload: join(__dirname, "preloads", "main.js"),
      },
    });
  }
}
