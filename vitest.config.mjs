import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    include: /.*\.[jt]sx?$/,
    jsx: "automatic",
    loader: "jsx",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    clearMocks: true,
    restoreMocks: true,
  },
});
