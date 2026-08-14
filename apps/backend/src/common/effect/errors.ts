import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly issues?: ReadonlyArray<string>;
}> {}

export class UnavailableError extends Data.TaggedError("UnavailableError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type DomainError = NotFoundError | ValidationError | UnavailableError;
