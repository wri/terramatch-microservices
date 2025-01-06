import { Sequelize } from "sequelize-typescript";
import { FactoryGirl, SequelizeAdapter } from "factory-girl-ts";
import * as Entities from "@terramatch-microservices/database/entities";

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
    // Switch to true locally to debug SQL statements in unit tests, especially table/index creation problems.
    logging: false
  });

  await sequelize.sync();
  FactoryGirl.setAdapter(new SequelizeAdapter());
});

afterAll(async () => {
  await sequelize.close();
});
