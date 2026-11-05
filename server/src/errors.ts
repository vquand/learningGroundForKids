import { ZodError } from "zod";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly safeMessage: string;
  readonly details?: unknown;

  constructor(status: number, code: string, safeMessage: string, details?: unknown) {
    super(safeMessage);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof ZodError) {
    return new AppError(400, "INVALID_REQUEST", "Request input is invalid.");
  }
  return new AppError(500, "INTERNAL_ERROR", "The server could not complete the request.");
}
