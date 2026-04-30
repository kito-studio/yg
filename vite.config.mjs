import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      ts: fileURLToPath(new URL("./ts", import.meta.url)),
      "@": fileURLToPath(new URL("./ts", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        settings: fileURLToPath(new URL("./settings.html", import.meta.url)),
        dbMaint: fileURLToPath(new URL("./db_maint.html", import.meta.url)),
      },
    },
  },
});
