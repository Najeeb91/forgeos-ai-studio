// ForgeOS targets a portable Node runtime so the web app can run independently
// of a single hosting vendor. Vercel can still adapt the generated output when
// deployed through its own adapter; Railway uses the Node server preset directly.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
});
