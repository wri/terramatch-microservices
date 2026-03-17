import { Sequelize } from "sequelize-typescript";
import { Umzug, SequelizeStorage } from "umzug";
import { ConfigService } from "@nestjs/config";
import path from "path";
import { SequelizeConfigService } from "./sequelize-config.service";

const configService = new ConfigService();
const sequelizeConfigService = new SequelizeConfigService(configService);
const options = sequelizeConfigService.createSequelizeOptions();

export const sequelize = new Sequelize({
  ...options,
  logging: options.logging ?? false
});

export const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, "migrations/*.{js,ts}")
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

export type MigrationContext = typeof umzug._types.context;
