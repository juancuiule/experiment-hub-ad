import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "../config/config.service";
import { DbService } from "./db.service";

const clientEnd = vi.fn().mockResolvedValue(undefined);
const postgresMock = vi.fn((...args: unknown[]) => {
  void args;
  return { end: clientEnd };
});
const drizzleMock = vi.fn((...args: unknown[]) => {
  void args;
  return { marker: "db" };
});

// The driver never connects in these tests: postgres.js is replaced so
// constructing DbService stays synchronous and offline.
vi.mock("postgres", () => ({
  default: (...args: unknown[]) => postgresMock(...args),
}));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: (...args: unknown[]) => drizzleMock(...args),
}));

function serviceWith(databaseUrl?: string) {
  const config = new ConfigService();
  const env = { PORT: "3001", DATABASE_URL: databaseUrl } as NodeJS.ProcessEnv;
  return new DbService({ load: () => config.load(env) } as ConfigService);
}

describe("DbService", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    drizzleMock.mockClear();
    clientEnd.mockClear();
  });

  it("builds the client from DATABASE_URL and wires drizzle to it", () => {
    const service = serviceWith("postgresql://user:pw@db:5432/experiment_hub");

    expect(postgresMock).toHaveBeenCalledWith("postgresql://user:pw@db:5432/experiment_hub");
    expect(drizzleMock).toHaveBeenCalledTimes(1);
    expect(service.db).toBe(drizzleMock.mock.results[0].value);
  });

  it("registers the schema with drizzle so relational queries resolve", () => {
    serviceWith("postgresql://user:pw@db:5432/experiment_hub");

    const options = drizzleMock.mock.calls[0][1] as {
      schema: Record<string, unknown>;
    };
    expect(options.schema).toHaveProperty("checkpoints");
  });

  it("falls back to the local-dev DATABASE_URL when the env var is absent", () => {
    serviceWith(undefined);

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://postgres:postgres@localhost:5432/experiment_hub",
    );
  });

  it("throws when the environment is invalid", () => {
    expect(() => serviceWith("")).toThrow();
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it("closes the client on module destroy", async () => {
    const service = serviceWith("postgresql://user:pw@db:5432/experiment_hub");

    await service.onModuleDestroy();

    expect(clientEnd).toHaveBeenCalledWith({ timeout: 5 });
  });
});
