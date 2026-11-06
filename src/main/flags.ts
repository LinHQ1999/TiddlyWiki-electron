import { app } from "electron";
import { debug } from "electron-log";

/**
 * Linux 下的 Chromium 启动参数，参考 Arch Wiki：
 * - Chromium#Hardware video acceleration
 * - Chromium#Native Wayland support
 *
 * 必须在 app ready 之前调用。
 */
export function applyLinuxFlags() {
  if (process.platform !== "linux") return;

  /**
   * Arch Wiki 要求 --enable-features 只能出现一次，
   * 因此先取用户已有的值再合并。
   */
  const features = app.commandLine
    .getSwitchValue("enable-features")
    .split(",")
    .map((feature) => feature.trim())
    .filter(Boolean);

  const linuxFeatures = [
    // VA-API 硬件解码 / 编码
    "AcceleratedVideoDecodeLinuxGL",
    "AcceleratedVideoEncoder",
    "VaapiVideoDecoder",
    "VaapiIgnoreDriverChecks",
    // Vulkan 渲染
    "Vulkan",
    "DefaultANGLEVulkan",
    "VulkanFromANGLE",
  ];

  for (const feature of linuxFeatures) {
    if (!features.includes(feature)) features.push(feature);
  }

  app.commandLine.appendSwitch("enable-features", features.join(","));

  // GTK4 输入法模块，用于修复 Wayland 下输入法无法使用的问题
  if (!app.commandLine.hasSwitch("gtk-version")) {
    app.commandLine.appendSwitch("gtk-version", "4");
  }

  debug(`Linux 启动参数：enable-features=${features.join(",")}`);
}
