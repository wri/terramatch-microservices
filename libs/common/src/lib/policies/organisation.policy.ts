import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Organisation, User } from "@terramatch-microservices/database/entities";
import { APPROVED, DRAFT } from "@terramatch-microservices/database/constants/status";

export class OrganisationPolicy extends UserPermissionsPolicy {
  async addRules() {
    this.builder.can("create", Organisation);

    if (this.frameworks.length > 0) {
      this.builder.can(["read", "update", "delete", "approveReject", "export"], Organisation);
    }

    if (this.permissions.includes("users-manage")) {
      this.builder.can(["uploadFiles", "deleteFiles", "updateFiles", "delete"], Organisation);
    }

    this.builder.can("listing", Organisation, {
      status: APPROVED,
      private: false,
      isTest: false
    });

    const user = await this.getUser();
    const organisationId = user?.organisationId;
    if (organisationId != null) {
      this.builder.can(["read", "approveReject"], Organisation, { id: organisationId });
      this.builder.can("delete", Organisation, { id: organisationId, status: DRAFT });

      if (this.permissions.includes("manage-own")) {
        this.builder.can(["update", "uploadFiles", "deleteFiles", "updateFiles"], Organisation, { id: organisationId });
      }
    }

    const projectOrgIds = await this.getProjectOrganisationIds();
    if (projectOrgIds.length > 0) {
      this.builder.can("read", Organisation, { id: { $in: projectOrgIds } });
    }

    this.builder.can("joinRequest", Organisation);
    if (user?.roles.includes("greenhouse-service-account")) {
      this.builder.cannot("joinRequest", Organisation);
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId", "id", "roles"],
      include: [{ association: "projects", attributes: ["id", "organisationId"] }]
    }));
  }

  protected _projectOrgIds?: number[];
  protected async getProjectOrganisationIds(): Promise<number[]> {
    if (this._projectOrgIds != null) return this._projectOrgIds;

    const user = await this.getUser();
    if (user?.projects == null) return (this._projectOrgIds = []);

    const orgIds = user.projects.map(({ organisationId }) => organisationId).filter((id): id is number => id != null);
    return (this._projectOrgIds = [...new Set(orgIds)]);
  }
}
