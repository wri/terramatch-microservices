import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Nursery, NurseryReport, Project, User } from "@terramatch-microservices/database/entities";
import { Op, WhereAttributeHash } from "sequelize";
import { AWAITING_APPROVAL, DUE, STARTED } from "@terramatch-microservices/database/constants/status";

export class NurseryReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("view-dashboard")) {
      this.builder.can("read", NurseryReport);
      return;
    }

    if (this.frameworks.length > 0) {
      this.builder.can(
        ["read", "delete", "update", "approve", "uploadFiles", "deleteFiles", "updateFiles", "updateAnswers"],
        NurseryReport,
        {
          frameworkKey: { $in: this.frameworks }
        }
      );
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds: WhereAttributeHash[] = [{ [Op.in]: user.projects.map(({ id }) => id) }];
        if (user.organisationId != null) {
          projectIds.push({ [Op.in]: Project.forOrganisation(user.organisationId) });
        }
        const nurseryIds = (
          await Nursery.findAll({
            where: { projectId: { [Op.or]: projectIds } },
            attributes: ["id"]
          })
        ).map(({ id }) => id);
        if (nurseryIds.length > 0) {
          this.builder.can(["read", "update", "uploadFiles", "deleteFiles", "updateFiles"], NurseryReport, {
            nurseryId: { $in: nurseryIds }
          });
          this.builder.can("updateAnswers", NurseryReport, {
            nurseryId: { $in: nurseryIds },
            status: { $in: [STARTED, DUE] }
          });
          this.builder.can("updateAnswers", NurseryReport, {
            nurseryId: { $in: nurseryIds },
            status: AWAITING_APPROVAL,
            nothingToReport: true
          });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          const nurseryIds = (
            await Nursery.findAll({ where: { projectId: { [Op.in]: projectIds } }, attributes: ["id"] })
          ).map(({ id }) => id);
          if (nurseryIds.length > 0) {
            this.builder.can(
              ["read", "delete", "update", "approve", "uploadFiles", "deleteFiles", "updateFiles", "updateAnswers"],
              NurseryReport,
              {
                nurseryId: { $in: nurseryIds }
              }
            );
          }
        }
      }
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}
