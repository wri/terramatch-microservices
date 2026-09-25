import { ModelCtor, Sequelize } from "sequelize-typescript";
import { FactoryGirl, SequelizeAdapter } from "factory-girl-ts";
import * as Entities from "@terramatch-microservices/database/entities";
import { SEQUELIZE_GLOBAL_HOOKS } from "@terramatch-microservices/database/sequelize-config.service";

let sequelize: Sequelize;

// Each nx project gets its own test DB so that project test runs may happen in parallel. The
// project name is taken from the test file path (apps/<project>/... or libs/<project>/...).
// To create these databases, run the ./bin/setup-test-database.sh script; keep the naming in sync.
const getTestDatabaseName = () => {
  const project = expect.getState().testPath?.match(/\/(?:apps|libs)\/([^/]+)\//)?.[1];
  if (project == null) throw new Error(`Unable to determine project for test: ${expect.getState().testPath}`);
  return `terramatch_microservices_test_${project.replace(/-/g, "_")}`;
};

beforeAll(async () => {
  sequelize = new Sequelize({
    dialect: "mariadb",
    dialectOptions: {
      supportBigNumbers: false,
      bigNumberStrings: false,
      decimalAsNumber: true,
      bigIntAsNumber: true,
      insertIdAsNumber: true
    },
    host: "localhost",
    port: 3360,
    username: "wri",
    password: "wri",
    database: getTestDatabaseName(),
    models: Object.values(Entities) as ModelCtor[],
    hooks: SEQUELIZE_GLOBAL_HOOKS,
    // Switch to console.log locally to debug SQL statements in unit tests, especially table/index creation problems.
    logging: false
  });

  FactoryGirl.setAdapter(new SequelizeAdapter());
});

afterAll(async () => {
  await sequelize.close();
});
