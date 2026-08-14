import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigService } from "./config.service";

describe("ConfigService", () => {
  it("parses a valid environment, defaulting NODE_ENV", async () => {
    const service = new ConfigService();
    const config = await Effect.runPromise(service.load({ PORT: "3001" }));
    expect(config).toEqual({ PORT: 3001, NODE_ENV: "development" });
  });

  it("fails with a ValidationError for a non-numeric PORT", async () => {
    const service = new ConfigService();
    const exit = await Effect.runPromiseExit(service.load({ PORT: "not-a-number" }));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails with a ValidationError for an unrecognized NODE_ENV", async () => {
    const service = new ConfigService();
    const exit = await Effect.runPromiseExit(
      service.load({ PORT: "3001", NODE_ENV: "staging" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
