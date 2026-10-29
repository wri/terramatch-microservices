import { RunnableMigration } from "umzug";
import { BIGINT, BOOLEAN, QueryInterface, STRING, TEXT } from "sequelize";

export const updateNotifications: RunnableMigration<QueryInterface> = {
  name: "202610201200-update-notifications",

  async up({ context }) {
    await context.addColumn("notifications", "project_id", {
      type: BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: "v2_projects", key: "id" },
      onDelete: "SET NULL"
    });
    await context.addColumn("notifications", "created_by", {
      type: BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL"
    });
    await context.addColumn("notifications", "summary", { type: STRING, allowNull: true });
    // First create the column with a default, then retype to avoid the default.
    await context.addColumn("notifications", "category", {
      type: STRING,
      allowNull: false,
      defaultValue: "project-reporting"
    });
    await context.changeColumn("notifications", "category", { type: STRING, allowNull: false });
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query(
      "ALTER TABLE `notifications` " +
        "DROP COLUMN IF EXISTS `title`, " +
        "DROP COLUMN IF EXISTS `body`, " +
        "DROP COLUMN IF EXISTS `action`, " +
        "DROP COLUMN IF EXISTS `hidden_from_app`"
    );
  },

  async down({ context }) {
    await context.addColumn("notifications", "title", { type: STRING, allowNull: true });
    await context.addColumn("notifications", "body", { type: TEXT({ length: "long" }), allowNull: true });
    await context.addColumn("notifications", "action", { type: STRING, allowNull: true });
    await context.addColumn("notifications", "hidden_from_app", {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await context.removeConstraint("notifications", "notifications_project_id_foreign_idx");
    await context.removeConstraint("notifications", "notifications_created_by_foreign_idx");
    await context.sequelize.query(
      "ALTER TABLE `notifications` " +
        "DROP COLUMN IF EXISTS `project_id`, " +
        "DROP COLUMN IF EXISTS `created_by`, " +
        "DROP COLUMN IF EXISTS `summary`, " +
        "DROP COLUMN IF EXISTS `category`"
    );
  }
};
