import { INTEGER, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const addOrderToPolygonAttributeDefinitions: RunnableMigration<QueryInterface> = {
  name: "202608191100-add-order-to-polygon-attribute-definitions",

  async up({ context }) {
    const transaction = await context.sequelize.transaction();

    try {
      await context.addColumn(
        "polygon_attribute_definitions",
        "order",
        { type: INTEGER, allowNull: true },
        { transaction }
      );

      await context.sequelize.query(`UPDATE polygon_attribute_definitions SET \`order\` = id WHERE \`order\` IS NULL`, {
        transaction
      });

      await context.changeColumn(
        "polygon_attribute_definitions",
        "order",
        { type: INTEGER, allowNull: false, defaultValue: 0 },
        { transaction }
      );

      await transaction.commit();
    } catch (e) {
      console.error("Error adding order column to polygon_attribute_definitions", e);
      await transaction.rollback();
      throw e;
    }
  },

  async down({ context }) {
    await context.removeColumn("polygon_attribute_definitions", "order");
  }
};
