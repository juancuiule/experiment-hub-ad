import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigService } from "./config.service";

describe("ConfigService", () => {
  it("parses a valid environment, defaulting NODE_ENV, DATABASE_URL and CORS_ORIGINS", async () => {
    const service = new ConfigService();
    const config = await Effect.runPromise(service.load({ PORT: "3001" }));
    expect(config).toEqual({
      PORT: 3001,
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/experiment_hub",
      CORS_ORIGINS: ["http://localhost:3000"],
    });
  });

  it("fails in production when DATABASE_URL is absent instead of using the dev default", async () => {
    const service = new ConfigService();
    const exit = await Effect.runPromiseExit(
      service.load({ PORT: "3001", NODE_ENV: "production" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("defaults to an empty CORS allowlist in production", async () => {
    const service = new ConfigService();
    const config = await Effect.runPromise(
      service.load({
        PORT: "3001",
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pw@db.example.com/prod",
      }),
    );
    expect(config.CORS_ORIGINS).toEqual([]);
  });

  it("parses CORS_ORIGINS as a trimmed, comma-separated allowlist", async () => {
    const service = new ConfigService();
    const config = await Effect.runPromise(
      service.load({
        PORT: "3001",
        CORS_ORIGINS: "https://app.example.com, https://admin.example.com ,",
      }),
    );
    expect(config.CORS_ORIGINS).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("honors an explicit DATABASE_URL", async () => {
    const service = new ConfigService();
    const config = await Effect.runPromise(
      service.load({ PORT: "3001", DATABASE_URL: "postgresql://user:pw@db.example.com/prod" }),
    );
    expect(config.DATABASE_URL).toBe("postgresql://user:pw@db.example.com/prod");
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
