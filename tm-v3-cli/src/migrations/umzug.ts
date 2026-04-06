import path from "path";
import { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

const migrationGlob = path.join(__dirname, "files", __filename.endsWith(".js") ? "*.js" : "*.ts");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const sequelize = new Sequelize({
  dialect: "mariadb",
  host: requireEnv("DB_HOST"),
  port: Number(requireEnv("DB_PORT")),
  username: requireEnv("DB_USERNAME"),
  password: process.env.DB_PASSWORD ?? "",
  database: requireEnv("DB_DATABASE"),
  logging: false
});

export const umzug = new Umzug({
  migrations: {
    glob: migrationGlob
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

export type MigrationContext = typeof umzug._types.context;
