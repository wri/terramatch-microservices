import { FormSubmission, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class FormSubmissionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read"], FormSubmission);
    }

    if (this.permissions.includes("manage-own")) {
      const orgUuids = await this.getOrgUuids();
      this.builder.can("read", FormSubmission, { organisationUuid: { $in: orgUuids } });
    }
  }

  protected _organisationUuids?: string[] | null;
  protected async getOrgUuids() {
    if (this._organisationUuids != null) return this._organisationUuids;

    this._organisationUuids = [];

    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "organisationId"],
      include: [{ association: "organisation", attributes: ["uuid"] }]
    });
    if (user == null) return this._organisationUuids;

    if (user.organisation != null) this._organisationUuids.push(user.organisation.uuid);

    const confirmed = await user.$get("organisationsConfirmed", { attributes: ["uuid"] });
    this._organisationUuids.push(...confirmed.map(({ uuid }) => uuid));

    return this._organisationUuids;
  }
}
