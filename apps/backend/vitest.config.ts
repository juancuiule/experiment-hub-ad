import { defineConfig } from "vitest/config";
import path from "path";
import swc from "unplugin-swc";

// Nest's dependency injection relies on `emitDecoratorMetadata`, which
// esbuild (Vitest's default transform) does not implement. SWC does, so
// tests that instantiate real Nest DI graphs (via @nestjs/testing) need
// this plugin rather than Vitest's built-in transform.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: [
      {
        find: /^@experiment-hub\/engine\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/engine/$1"),
      },
    ],
  },
});
