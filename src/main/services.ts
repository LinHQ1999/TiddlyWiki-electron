import log, { info, debug } from "electron-log";
import { config } from "./config";
import { Notification, shell } from "electron";
import { UtilityProcess, utilityProcess } from "electron/main";

interface Service {
  twInstance: UtilityProcess;
  port: number;
}

class TWServices {
  static services = new Set<Service>();
  /**
   * 启动 nodejs 版 wiki, 考虑结合 enum 实现
   * @param {string} dir wiki 所在目录
   * @param {number} port 端口，如果被占用则递增，不应由用户设定
   * @param {string[]} args 额外启动参数，一行一组
   * @returns
   */
  static async launch(dir: string, port: number, ...args: string[]): Promise<Service> {
    debug('启动 tiddlywiki.js')

    port = TWServices.schport(port);

    const tw = await config.getTW();
    debug('已获取 tiddlywiki.js 路径')
    if (!tw) {
      const guide = new Notification({ title: "请执行 npm i -g tiddlywiki" });
      guide.show();
      guide.once("click", () =>
        shell.openPath(log.transports.file.getFile().path),
      );
      throw new Error("No tw detected!");
    }

    const twInstance = utilityProcess.fork(tw, [dir, "--listen", `port=${port}`].concat(args), { stdio: 'pipe' }); /* 不指定为 pipe stdout 无法接收 data */
    twInstance.on("exit", () => {
      info("子进程已成功结束");
    });

    const instance = {  twInstance, port };
    TWServices.services.add(instance);
    return instance;
  }

  /**
   * 解决端口冲突
   * @param port 预期端口号
   * @returns 解决冲突后的端口号
   */
  static schport(port: number): number {
    // 先判断在不在表中很有必要，否则端口可能会取到负数
    let actual = port;
    for (const service of TWServices.services) {
      if (service.port == actual) {
        actual = service.port + 1;
      }
    }
    return actual;
  }

  /**
   * 根据端口号停止服务进程
   *
   * @param service 返回的服务
   */
  static stop(service: Service) {
    service.twInstance.kill();
    TWServices.services.delete(service);
  }

  static stopAll() {
    for (const service of TWServices.services) {
      TWServices.stop(service);
    }
  }
}

export { Service, TWServices as TWService };
