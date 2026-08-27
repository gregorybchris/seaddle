import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { adminApi } from "./vite-plugins/admin-api";

export default defineConfig({
  plugins: [react(), tailwindcss(), adminApi()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    watch: {
      /**
       * The admin writes here on every edit, and a watched write triggers a
       * full page reload even though nothing imports these files — which
       * throws away the map viewport in the middle of placing junctions.
       * Nothing under src/db is part of the client module graph: the admin
       * reads it over /__admin and the site reads the compiled GeoJSON, so
       * there is nothing here for HMR to do anyway.
       */
      ignored: ["**/src/db/**"],
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
