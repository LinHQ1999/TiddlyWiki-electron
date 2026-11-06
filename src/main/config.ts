import { exec as _exec } from "child_process";
import { promisify } from 'util'
import { debug, info } from "electron-log";
import { default as ElectronStore, default as Store } from "electron-store";
import { join } from "path";
import { platform } from "os";
import { pathExists } from "fs-extra";

const exec = promisify(_exec)
/**
 * 环境参数
 */
interface Env {
  os: string;
  // tiddlywiki.js 路径
  tw: string | undefined;

  opened: string;
}

class Config {
  // 持久化配置/状态
  store: ElectronStore<Env>;

  constructor() {
    this.store = new Store<Env>({
      defaults: {
        os: platform(),
        tw: undefined,
        opened: "",
      },
    });

    debug(this.store.store);
    debug(this.Opened);
  }

  /**
   * 缓存 -> 实时 -> undefined
   * 执行 npm root -g 是启动性能瓶颈之一
   */
  async getTW(): Promise<string | undefined> {
    const prev = this.store.get("tw");
    if (await pathExists(prev as string)) return prev;
    const { stdout } = await exec("npm root -g")
    const tw = join(
      stdout.toString().trim(),
      "tiddlywiki",
      "tiddlywiki.js",
    );
    info(`更新 tw 路径 ${prev} --> ${tw}`);
    this.tw = tw
    return await pathExists(tw) ? tw : undefined;
  }

  set tw(path: string) {
    this.store.set("tw", path);
  }

  /**
   * 提供兼容层
   */
  get env() {
    return this.store.store;
  }

  set Opened(dir: string) {
    this.store.set("opened", dir);
  }

  get Opened(): string {
    return this.store.get("opened");
  }
}

export const config = new Config();
