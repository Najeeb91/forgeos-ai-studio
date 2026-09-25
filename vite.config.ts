// ForgeOS uses the Lovable TanStack Start wrapper for its shared Vite setup.
// For Vercel, Nitro must target Vercel rather than the Node server preset.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
});
