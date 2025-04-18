import { Sequelize } from "sequelize-typescript";
import { FactoryGirl, SequelizeAdapter } from "factory-girl-ts";
import * as Entities from "@terramatch-microservices/database/entities";
import { SEQUELIZE_GLOBAL_HOOKS } from "@terramatch-microservices/database/sequelize-config.service";

let sequelize: Sequelize;

beforeAll(async () => {
  // To create this database, run the ./setup-test-database.sh script.
  sequelize = new Sequelize({
    dialect: "mariadb",
    host: "localhost",
    port: 3360,
    username: "wri",
    password: "wri",
    database: "terramatch_microservices_test",
    models: Object.values(Entities),
    hooks: SEQUELIZE_GLOBAL_HOOKS,
    // Switch to console.log locally to debug SQL statements in unit tests, especially table/index creation problems.
    logging: false
  });

  FactoryGirl.setAdapter(new SequelizeAdapter());
});

afterAll(async () => {
  await sequelize.close();
});
