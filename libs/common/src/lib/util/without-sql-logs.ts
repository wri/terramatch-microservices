import { SequelizeOptions } from "sequelize-typescript";
import { User } from "@terramatch-microservices/database/entities";

export async function withoutSqlLogs(closure: () => Promise<unknown>) {
  const options = (User.sequelize as unknown as { options: SequelizeOptions }).options;
  const log = options.logging;
  options.logging = false;
  const result = await closure();
  options.logging = log;
  return result;
}
