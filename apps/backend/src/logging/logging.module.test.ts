import { PARAMS_PROVIDER_TOKEN } from "nestjs-pino";
import { afterEach, describe, expect, it, vi } from "vitest";

type PinoHttpOptions = {
  level: string;
  transport?: { target: string; options?: Record<string, unknown> };
  redact: string[];
  customProps: () => Record<string, unknown>;
};

/**
 * `LoggingModule` reads NODE_ENV at import time, so each case re-imports the
 * module with the env stubbed. Reading the registered params out of the
 * `LoggerModule.forRoot()` metadata keeps this assertion-only — no pino
 * instance (and no pino-pretty worker thread) is ever created.
 */
async function loadPinoHttpOptions(nodeEnv: string): Promise<PinoHttpOptions> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  const { LoggingModule } = await import("./logging.module");
  const [loggerModule] = Reflect.getMetadata("imports", LoggingModule) as {
    providers: { provide: unknown; useValue?: { pinoHttp: PinoHttpOptions } }[];
  }[];
  const params = loggerModule.providers.find((p) => p.provide === PARAMS_PROVIDER_TOKEN);
  if (!params?.useValue) {
    throw new Error("LoggerModule.forRoot params provider not found");
  }
  return params.useValue.pinoHttp;
}

describe("LoggingModule", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("logs JSON at info level in production", async () => {
    const options = await loadPinoHttpOptions("production");

    expect(options.level).toBe("info");
    expect(options.transport).toBeUndefined();
  });

  it("logs pretty-printed debug output outside production", async () => {
    const options = await loadPinoHttpOptions("development");

    expect(options.level).toBe("debug");
    expect(options.transport).toEqual({
      target: "pino-pretty",
      options: { singleLine: true },
    });
  });

  it("redacts credential-bearing headers in every environment", async () => {
    for (const nodeEnv of ["production", "development", "test"]) {
      const options = await loadPinoHttpOptions(nodeEnv);
      expect(options.redact).toEqual(["req.headers.authorization", "req.headers.cookie"]);
    }
  });

  it("tags every log line with the service name", async () => {
    const options = await loadPinoHttpOptions("production");

    expect(options.customProps()).toEqual({ service: "experiment-hub-backend" });
  });
});
