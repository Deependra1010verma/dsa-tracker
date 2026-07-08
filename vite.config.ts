import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      __LOGIN_USERNAME__: JSON.stringify(env.USERNAME ?? ""),
      __LOGIN_PASSWORD__: JSON.stringify(env.PASSWORD ?? ""),
    },
    build: {
      outDir: "dist/web",
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://127.0.0.1:4000",
      },
    },
  };
});
