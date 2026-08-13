import { BIGINT, BOOLEAN, DATE, INTEGER, JSON, QueryInterface, STRING, UUID } from "sequelize";
import { RunnableMigration } from "umzug";

export const addPolygonAttributeTables: RunnableMigration<QueryInterface> = {
  name: "202608131700-add-polygon-attribute-tables",

  async up({ context }) {
    const transaction = await context.sequelize.transaction();

    try {
      await context.createTable(
        "polygon_attribute_definitions",
        {
          id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
          uuid: { type: UUID, allowNull: false },
          key: { type: STRING, allowNull: false },
          label: { type: STRING, allowNull: false },
          input_type: { type: STRING, allowNull: false },
          framework_key: { type: STRING, allowNull: false },
          is_required: { type: BOOLEAN, allowNull: false, defaultValue: false },
          is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: DATE, allowNull: true },
          updated_at: { type: DATE, allowNull: true },
          deleted_at: { type: DATE, allowNull: true }
        },
        { transaction }
      );

      await context.addIndex("polygon_attribute_definitions", ["uuid"], {
        name: "polygon_attribute_definitions_uuid_unique",
        unique: true,
        transaction
      });

      await context.addIndex("polygon_attribute_definitions", ["framework_key", "key"], {
        name: "polygon_attribute_definitions_framework_key_key_unique",
        unique: true,
        transaction
      });

      await context.createTable(
        "polygon_attribute_definition_options",
        {
          id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
          uuid: { type: UUID, allowNull: false },
          polygon_attribute_definition_id: { type: BIGINT.UNSIGNED, allowNull: false },
          value: { type: STRING, allowNull: false },
          label: { type: STRING, allowNull: false },
          order: { type: INTEGER, allowNull: false },
          created_at: { type: DATE, allowNull: true },
          updated_at: { type: DATE, allowNull: true },
          deleted_at: { type: DATE, allowNull: true }
        },
        { transaction }
      );

      await context.addIndex("polygon_attribute_definition_options", ["uuid"], {
        name: "polygon_attribute_definition_options_uuid",
        unique: false,
        transaction
      });

      await context.addIndex("polygon_attribute_definition_options", ["polygon_attribute_definition_id"], {
        name: "pad_options_definition_id",
        unique: false,
        transaction
      });

      await context.addIndex("polygon_attribute_definition_options", ["polygon_attribute_definition_id", "value"], {
        name: "pad_options_definition_id_value_unique",
        unique: true,
        transaction
      });

      await context.createTable(
        "site_polygon_attribute_values",
        {
          id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
          site_polygon_uuid: { type: UUID, allowNull: false },
          polygon_attribute_definition_id: { type: BIGINT.UNSIGNED, allowNull: false },
          value: { type: JSON, allowNull: true },
          created_at: { type: DATE, allowNull: true },
          updated_at: { type: DATE, allowNull: true }
        },
        { transaction }
      );

      await context.addIndex("site_polygon_attribute_values", ["site_polygon_uuid"], {
        name: "spav_site_polygon_uuid",
        unique: false,
        transaction
      });

      await context.addIndex("site_polygon_attribute_values", ["polygon_attribute_definition_id"], {
        name: "spav_definition_id",
        unique: false,
        transaction
      });

      await context.addIndex(
        "site_polygon_attribute_values",
        ["site_polygon_uuid", "polygon_attribute_definition_id"],
        {
          name: "spav_polygon_definition_unique",
          unique: true,
          transaction
        }
      );

      await transaction.commit();
    } catch (e) {
      console.error("Error creating polygon attribute tables", e);
      await transaction.rollback();
      throw e;
    }
  },

  async down({ context }) {
    await context.dropTable("site_polygon_attribute_values");
    await context.dropTable("polygon_attribute_definition_options");
    await context.dropTable("polygon_attribute_definitions");
  }
};
