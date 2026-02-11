import { SequelizeOptions } from "sequelize-typescript";
import { User } from "@terramatch-microservices/database/entities";

/**
 * Wraps a one-off script to turn off SQL logs for the duration of the script run. The return value
 * is a function with the same signature as the closure argument.
 */
export const withoutSqlLogs =
  <T extends (...args: unknown[]) => Promise<unknown>>(
    closure: T
  ): ((...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>) =>
  async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const options = (User.sequelize as unknown as { options: SequelizeOptions }).options;
    const log = options.logging;
    options.logging = false;
    const result = (await closure(...args)) as Awaited<ReturnType<T>>;
    options.logging = log;
    return result;
  };
