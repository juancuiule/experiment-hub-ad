import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ConfigService } from "../../config/config.service";
import { SharedSecretGuard } from "./shared-secret.guard";

function contextFor(method: string, headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe("SharedSecretGuard", () => {
  it("allows GET requests regardless of the secret", () => {
    const config = { load: () => ({ pipe: () => undefined }) } as unknown as ConfigService;
    const guard = new SharedSecretGuard(config);
    expect(guard.canActivate(contextFor("GET"))).toBe(true);
  });

  it("allows any non-GET request when API_SHARED_SECRET is unset", () => {
    const config = new ConfigService();
    const guard = new SharedSecretGuard(config);
    expect(guard.canActivate(contextFor("POST"))).toBe(true);
  });

  it("rejects a non-GET request missing the bearer header when a secret is configured", () => {
    const config = new ConfigService();
    const originalLoad = config.load.bind(config);
    config.load = (env = process.env) => originalLoad({ ...env, API_SHARED_SECRET: "topsecret" });
    const guard = new SharedSecretGuard(config);
    expect(() => guard.canActivate(contextFor("POST"))).toThrow(UnauthorizedException);
  });

  it("rejects a non-GET request with the wrong bearer secret", () => {
    const config = new ConfigService();
    const originalLoad = config.load.bind(config);
    config.load = (env = process.env) => originalLoad({ ...env, API_SHARED_SECRET: "topsecret" });
    const guard = new SharedSecretGuard(config);
    expect(() =>
      guard.canActivate(contextFor("POST", { authorization: "Bearer wrong" })),
    ).toThrow(UnauthorizedException);
  });

  it("allows a non-GET request with the correct bearer secret", () => {
    const config = new ConfigService();
    const originalLoad = config.load.bind(config);
    config.load = (env = process.env) => originalLoad({ ...env, API_SHARED_SECRET: "topsecret" });
    const guard = new SharedSecretGuard(config);
    expect(
      guard.canActivate(contextFor("POST", { authorization: "Bearer topsecret" })),
    ).toBe(true);
  });
});
