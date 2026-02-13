import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Organisation, User } from "@terramatch-microservices/database/entities";

export class OrganisationPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "update", "delete"], Organisation);
    }

    if (this.permissions.includes("users-manage")) {
      this.builder.can(["create", "uploadFiles", "deleteFiles", "updateFiles", "delete"], Organisation);
    }

    const orgUuids = await this.getOrgUuids();
    if (orgUuids.length > 0) {
      this.builder.can("read", Organisation, { uuid: { $in: orgUuids } });
    }

    const projectOrgIds = await this.getProjectOrganisationIds();
    if (projectOrgIds.length > 0) {
      this.builder.can("read", Organisation, { id: { $in: projectOrgIds } });
    }

    if (this.permissions.includes("manage-own")) {
      const primaryOrg = await this.getPrimaryOrganisation();
      if (primaryOrg != null) {
        this.builder.can(["update", "uploadFiles", "deleteFiles", "updateFiles"], Organisation, {
          id: primaryOrg.id
        });
      }

      const user = await this.getUser();
      if (user != null && user.organisationsConfirmed != null) {
        const confirmedOrgIds = user.organisationsConfirmed.map(({ id }) => id);
        if (confirmedOrgIds.length > 0) {
          this.builder.can("update", Organisation, { id: { $in: confirmedOrgIds } });
        }
      }
    }
  }

  protected _primaryOrg?: Organisation | null;
  protected async getPrimaryOrganisation() {
    if (this._primaryOrg != null) return this._primaryOrg;

    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId", "id"]
    });
    return (this._primaryOrg = await user?.primaryOrganisation());
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId", "id"],
      include: [
        { association: "projects", attributes: ["id", "organisationId"] },
        { association: "organisationsConfirmed", attributes: ["id"] }
      ]
    }));
  }

  protected _projectOrgIds?: number[];
  protected async getProjectOrganisationIds(): Promise<number[]> {
    if (this._projectOrgIds != null) return this._projectOrgIds;

    const user = await this.getUser();
    if (user == null || user.projects == null) return (this._projectOrgIds = []);

    const orgIds = user.projects.map(({ organisationId }) => organisationId).filter((id): id is number => id != null);
    return (this._projectOrgIds = [...new Set(orgIds)]);
  }
}
