import {
  FundingProgramme,
  Organisation,
  ProjectPitch,
  ProjectPolygon,
  User
} from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Op } from "sequelize";

export class ProjectPolygonPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can(["read", "create", "update", "delete"], ProjectPolygon);
      return;
    }

    if (this.frameworks.length > 0) {
      const fundingProgrammes = await FundingProgramme.findAll({
        where: { frameworkKey: { [Op.in]: this.frameworks } },
        attributes: ["uuid"]
      });
      const fundingProgrammeUuids = fundingProgrammes.map(fp => fp.uuid);

      if (fundingProgrammeUuids.length > 0) {
        const projectPitches = await ProjectPitch.findAll({
          where: { fundingProgrammeId: { [Op.in]: fundingProgrammeUuids } },
          attributes: ["id"]
        });
        const projectPitchIds = projectPitches.map(pitch => pitch.id);
        if (projectPitchIds.length > 0) {
          this.builder.can(["read", "create"], ProjectPolygon, {
            entityType: ProjectPitch.LARAVEL_TYPE,
            entityId: { $in: projectPitchIds }
          });
        }
      }
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user?.organisationId != null) {
        const orgUuid = (await Organisation.findOne({ where: { id: user.organisationId }, attributes: ["uuid"] }))
          ?.uuid;
        if (orgUuid != null) {
          const projectPitches = await ProjectPitch.findAll({
            where: { organisationId: orgUuid },
            attributes: ["id"]
          });
          const projectPitchIds = projectPitches.map(pitch => pitch.id);
          if (projectPitchIds.length > 0) {
            this.builder.can(["read", "create", "update", "delete"], ProjectPolygon, {
              entityType: ProjectPitch.LARAVEL_TYPE,
              entityId: { $in: projectPitchIds }
            });
          }
        }
      }
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"], through: { attributes: ["isManaging"] } }]
    }));
  }
}
