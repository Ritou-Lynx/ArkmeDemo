import react from "@vitejs/plugin-react";
import { build } from "vite";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const srcDir = fileURLToPath(new URL("../src", import.meta.url));

await build({
  configFile: false,
  root: rootDir,
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
});
