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
       *
       * The compiled GeoJSON is ignored for the same reason. The admin now
       * rebuilds it on every save, and a watched write there would reload the
       * page being worked in — the site picks the new file up on its next
       * load, which is when it asks for it.
       */
      ignored: ["**/src/db/**", "**/public/*.geojson"],
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
