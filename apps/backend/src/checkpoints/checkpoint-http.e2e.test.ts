import { Test } from "@nestjs/testing";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { enableCors } from "../cors";
import { CHECKPOINTS_REPOSITORY, CheckpointsRepository } from "./checkpoints.repository";

// This is the regression test for GH #35: `curl` never preflights, so a
// controller-level unit test (which never touches HTTP) also can't catch a
// missing `app.enableCors()`. Only a real listening server, hit with a real
// `fetch`, exercises the browser's OPTIONS-preflight-then-POST sequence.
class FakeCheckpointsRepository implements CheckpointsRepository {
  insert(input: Parameters<CheckpointsRepository["insert"]>[0]) {
    return Effect.succeed({
      ...input,
      id: "00000000-0000-0000-0000-000000000000",
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  }
}

describe("checkpoint submission over real HTTP", () => {
  let app: NestExpressApplication;
  let baseUrl: string;

  // Bootstrapping a full Nest app (SWC-compiled DI graph) is slow under the
  // parallel load of the full test suite, well beyond vitest's 10s default
  // hook timeout — this hook is otherwise fast in isolation.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CHECKPOINTS_REPOSITORY)
      .useValue(new FakeCheckpointsRepository())
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    enableCors(app);
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 30000);

  afterEach(async () => {
    await app.close();
  });

  it("allows the frontend origin's preflight for POST /checkpoints", async () => {
    const response = await fetch(`${baseUrl}/checkpoints`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("persists a real checkpoint submitted as a browser would: preflight, then POST", async () => {
    const preflight = await fetch(`${baseUrl}/checkpoints`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.status).toBeLessThan(300);

    const response = await fetch(`${baseUrl}/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        experimentSlug: "ocean",
        sessionId: "session-1",
        checkpointName: "intro-complete",
        context: { data: { age: 30 } },
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const body = await response.json();
    expect(body).toEqual({ id: "00000000-0000-0000-0000-000000000000", createdAt: "2026-08-14T00:00:00.000Z" });
  }, 15000);
});
