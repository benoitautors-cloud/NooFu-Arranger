import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  webServer: {
    command: "npm exec vite preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173/NooFu-Arranger/",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:4173/NooFu-Arranger/",
    hasTouch: true,
    viewport: { width: 393, height: 851 },
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
});
