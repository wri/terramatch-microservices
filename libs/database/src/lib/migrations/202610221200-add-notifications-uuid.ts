import { RunnableMigration } from "umzug";
import { QueryInterface, UUID } from "sequelize";

export const addNotificationsUuid: RunnableMigration<QueryInterface> = {
  name: "202610221200-add-notifications-uuid",

  async up({ context }) {
    // The notifications table was emptied in 202610201200-update-notifications, so no backfill is needed.
    await context.addColumn("notifications", "uuid", { type: UUID, allowNull: false });
    await context.addIndex("notifications", ["uuid"], { name: "notifications_uuid_index" });
  },

  async down({ context }) {
    await context.removeIndex("notifications", "notifications_uuid_index");
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `notifications` DROP COLUMN IF EXISTS `uuid`");
  }
};
