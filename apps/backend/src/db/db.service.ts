import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Effect } from "effect";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ConfigService } from "../config/config.service";
import * as schema from "./schema";

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly client: postgres.Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(config: ConfigService) {
    // postgres.js connects lazily on first query, so building the client here
    // is synchronous — no need for an async factory provider.
    const { DATABASE_URL, NODE_ENV } = Effect.runSync(config.load());
    this.client = postgres(DATABASE_URL, {
      max: 10,
      // Managed Postgres providers (RDS, Supabase, etc.) require TLS; local
      // dev/test Postgres does not have a cert configured.
      ssl: NODE_ENV === "production" ? "require" : false,
    });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
