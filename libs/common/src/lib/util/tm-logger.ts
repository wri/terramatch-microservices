/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsoleLogger } from "@nestjs/common";

const IS_PROD = process.env["NODE_ENV"] === "production";
const IS_TEST = process.env["NODE_ENV"] === "test";

export class TMLogger extends ConsoleLogger {
  constructor(context?: string) {
    super({
      json: IS_PROD,
      logLevels: IS_TEST ? [] : IS_PROD ? ["log", "error", "warn"] : undefined,
      context
    });
  }
}
