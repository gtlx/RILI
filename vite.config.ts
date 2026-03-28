import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/ 配置
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite 选项，专为 Tauri 开发定制，仅在 `tauri dev` 或 `tauri build` 时应用
  //
  // 1. 防止 Vite 遮挡 rust 错误
  clearScreen: false,
  // 2. tauri 需要固定端口，如果该端口不可用则失败
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. 告诉 Vite 忽略监视 `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
