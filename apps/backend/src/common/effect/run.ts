import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Cause, Effect, Exit } from "effect";
import { DomainError } from "./errors";

function toHttpException(error: DomainError): HttpException {
  switch (error._tag) {
    case "NotFoundError":
      return new NotFoundException(
        error.id ? `${error.resource} not found: ${error.id}` : `${error.resource} not found`,
      );
    case "ValidationError":
      return new BadRequestException(error.issues ?? error.message);
    case "UnavailableError":
      return new InternalServerErrorException(error.message);
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
  throw Cause.squash(exit.cause);
}
