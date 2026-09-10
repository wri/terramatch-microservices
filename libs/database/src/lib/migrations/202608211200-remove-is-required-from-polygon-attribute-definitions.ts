import { BOOLEAN, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const removeIsRequiredFromPolygonAttributeDefinitions: RunnableMigration<QueryInterface> = {
  name: "202608211200-remove-is-required-from-polygon-attribute-definitions",

  async up({ context }) {
    await context.removeColumn("polygon_attribute_definitions", "is_required");
  },

  async down({ context }) {
    await context.addColumn("polygon_attribute_definitions", "is_required", {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  }
};
