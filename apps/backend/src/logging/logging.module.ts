import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

const isProduction = process.env.NODE_ENV === "production";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProduction ? "info" : "debug",
        transport: isProduction
          ? undefined
          : { target: "pino-pretty", options: { singleLine: true } },
        // Never log credentials, even at debug level in local dev.
        redact: ["req.headers.authorization", "req.headers.cookie"],
        customProps: () => ({ service: "experiment-hub-backend" }),
      },
    }),
  ],
})
export class LoggingModule {}
