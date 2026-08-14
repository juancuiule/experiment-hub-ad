import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cause, Effect, Exit } from "effect";
import { DomainError } from "./errors";

const logger = new Logger("runController");

function toHttpException(error: DomainError): HttpException {
  switch (error._tag) {
    case "NotFoundError":
      return new NotFoundException(
        error.id ? `${error.resource} not found: ${error.id}` : `${error.resource} not found`,
      );
    case "ValidationError":
      return new BadRequestException(error.issues ?? error.message);
    case "UnavailableError":
      // `cause` holds the driver/network error that actually explains the
      // failure and is never sent to the client, so log it here — otherwise
      // the only trace of it is a bare 500.
      logger.error(error.message, toStack(error.cause));
      return new InternalServerErrorException(error.message, { cause: error.cause });
  }
}

/**
 * Runs a controller-level Effect and adapts it to the Promise-based
 * contract Nest controllers expect. DomainError failures become the
 * matching HttpException; defects (unexpected throws, e.g. from a driver)
 * are rethrown as-is so Nest's global exception filter logs the full
 * cause instead of a squashed 500.
 */
export async function runController<A>(effect: Effect.Effect<A, DomainError>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "Some") {
    throw toHttpException(failure.value);
  }
  const defect = Cause.squash(exit.cause);
  logger.error("Unexpected defect while running controller effect", toStack(defect));
  throw defect;
}

function toStack(cause: unknown): string | undefined {
  if (cause === undefined) return undefined;
  return cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
}
