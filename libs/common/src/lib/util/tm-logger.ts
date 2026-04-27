/* eslint-disable @typescript-eslint/no-explicit-any */
/* istanbul ignore file */
import { ConsoleLogger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

const IS_PROD = process.env["NODE_ENV"] === "production";
const IS_REPL = process.env["REPL"] === "true";
const IS_TEST = process.env["NODE_ENV"] === "test";

export class TMLogger extends ConsoleLogger {
  constructor(context?: string) {
    super({
      json: IS_PROD && !IS_REPL,
      logLevels: IS_TEST ? [] : IS_PROD ? ["log", "error", "warn"] : undefined,
      context
    });
  }

  error(message: any, ...optionalParams: any[]) {
    const error = optionalParams.find(param => param instanceof Error);
    if (error != null) {
      optionalParams = [error.stack, optionalParams.filter(param => !(param instanceof Error))];
    }

    Sentry.captureException(error ?? new Error(message));
    super.error(message, ...optionalParams);
  }
}
