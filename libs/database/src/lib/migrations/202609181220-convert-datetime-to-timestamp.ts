import { RunnableMigration } from "umzug";
import { DATE, QueryInterface, QueryTypes } from "sequelize";

const DATETIME_COLUMNS: { table: string; column: string }[] = [
  { table: "about_sections", column: "created_at" },
  { table: "about_sections", column: "deleted_at" },
  { table: "about_sections", column: "updated_at" },
  { table: "links", column: "created_at" },
  { table: "links", column: "deleted_at" },
  { table: "links", column: "updated_at" },
  { table: "polygon_attribute_definitions", column: "created_at" },
  { table: "polygon_attribute_definitions", column: "deleted_at" },
  { table: "polygon_attribute_definitions", column: "updated_at" },
  { table: "polygon_attribute_definition_options", column: "created_at" },
  { table: "polygon_attribute_definition_options", column: "deleted_at" },
  { table: "polygon_attribute_definition_options", column: "updated_at" },
  { table: "site_polygon_attribute_values", column: "created_at" },
  { table: "site_polygon_attribute_values", column: "updated_at" },
  { table: "users", column: "email_address_verified_at" },
  { table: "users", column: "last_logged_in_at" },
  { table: "v2_nursery_reports", column: "submitted_at" },
  { table: "v2_organisation_invites", column: "accepted_at" },
  { table: "v2_project_invites", column: "accepted_at" },
  { table: "v2_project_reports", column: "submitted_at" },
  { table: "v2_site_reports", column: "submitted_at" }
];

type SchemaColumn = { TABLE_NAME: string; COLUMN_NAME: string };

const quoteIdent = (name: string) => `\`${name.replace(/`/g, "``")}\``;

async function changeColumnType(
  context: QueryInterface,
  table: string,
  column: string,
  columnType: "TIMESTAMP" | "DATETIME"
) {
  const quotedTable = quoteIdent(table);
  const quotedColumn = quoteIdent(column);
  if (columnType === "TIMESTAMP") {
    await context.sequelize.query(
      `UPDATE ${quotedTable} SET ${quotedColumn} = NULL WHERE ${quotedColumn} IS NOT NULL AND UNIX_TIMESTAMP(${quotedColumn}) IS NULL`
    );
  }

  await context.sequelize.query(`ALTER TABLE ${quotedTable} MODIFY ${quotedColumn} ${columnType} NULL DEFAULT NULL`);
}

async function findExecuteAtColumns(context: QueryInterface): Promise<SchemaColumn[]> {
  return await context.sequelize.query<SchemaColumn>(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) IN ('event', 'events')
       AND LOWER(COLUMN_NAME) = 'execute_at'`,
    { type: QueryTypes.SELECT }
  );
}

export const convertDatetimeToTimestamp: RunnableMigration<QueryInterface> = {
  name: "202609181220-convert-datetime-to-timestamp",

  async up({ context }) {
    for (const { table, column } of DATETIME_COLUMNS) {
      await changeColumnType(context, table, column, "TIMESTAMP");
    }

    for (const { TABLE_NAME, COLUMN_NAME } of await findExecuteAtColumns(context)) {
      await changeColumnType(context, TABLE_NAME, COLUMN_NAME, "TIMESTAMP");
    }
  },

  async down({ context }) {
    for (const { table, column } of DATETIME_COLUMNS) {
      await context.changeColumn(table, column, {
        type: DATE,
        allowNull: true
      });
    }

    for (const { TABLE_NAME, COLUMN_NAME } of await findExecuteAtColumns(context)) {
      await changeColumnType(context, TABLE_NAME, COLUMN_NAME, "DATETIME");
    }
  }
};
