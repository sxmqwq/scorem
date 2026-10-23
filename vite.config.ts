import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [vue()],
    base: env.VITE_BASE_PATH || "/scorem/",
    server: {
      host: "0.0.0.0",
      port: 4173,
      allowedHosts: ["terminal.local"],
      proxy: { "/api": { target: "http://127.0.0.1:8787" } },
    },
    build: { sourcemap: false },
  };
});
