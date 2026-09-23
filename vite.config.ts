// @lovable.dev/vite-tanstack-config provides the TanStack Start/Vite integration.
// ForgeOS is deployed as a normal Node server on Railway, so pin Nitro to
// the portable Node target instead of the wrapper's Cloudflare default.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
});
