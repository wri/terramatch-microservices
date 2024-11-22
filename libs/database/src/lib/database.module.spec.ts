import * as Entities from "./entities";

describe("DatabaseModule", () => {
  it("Successfully syncs the database schema", async () => {
    for (const Entity of Object.values(Entities)) {
      await expect(Entity.sequelize?.getQueryInterface().tableExists(Entity.tableName)).resolves.toBe(true);
    }
  });
});
