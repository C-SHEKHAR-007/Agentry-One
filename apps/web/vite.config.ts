import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/** The production Content-Security-Policy, read from the nginx config that
 * serves it (with CSP_CONNECT_EXTRA empty). `vite preview` -- what the e2e
 * suite drives -- sends it too, so code that needs eval or inline scripts
 * fails in tests instead of only in production. */
const nginxConf = readFileSync(fileURLToPath(new URL("./nginx.conf.template", import.meta.url)), "utf8");
const productionCsp = nginxConf.match(/Content-Security-Policy "([^"]+)"/)?.[1]?.replace("${CSP_CONNECT_EXTRA}", "");
if (!productionCsp) throw new Error("vite.config: no Content-Security-Policy found in nginx.conf.template");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Overridable so e2e tests can point a dev server at a disposable API.
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    headers: { "Content-Security-Policy": productionCsp },
  },
});
