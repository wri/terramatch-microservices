import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const renameOrganisationUserToJoinRequests: RunnableMigration<QueryInterface> = {
  name: "202610281200-rename-organisation-user-to-join-requests",

  async up({ context }) {
    await context.renameTable("organisation_user", "organisation_join_requests");
    await context.addIndex("organisation_join_requests", ["organisation_id", "status"], {
      name: "organisation_join_requests_organisation_id_status_index"
    });
    await context.addIndex("organisation_join_requests", ["user_id"], {
      name: "organisation_join_requests_user_id_index"
    });
  },

  async down({ context }) {
    await context.removeIndex("organisation_join_requests", "organisation_join_requests_user_id_index");
    await context.removeIndex("organisation_join_requests", "organisation_join_requests_organisation_id_status_index");
    await context.renameTable("organisation_join_requests", "organisation_user");
  }
};
