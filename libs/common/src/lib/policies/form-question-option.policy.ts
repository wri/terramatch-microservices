import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FormQuestionOption, Form, User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

export class FormQuestionOptionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      const forms = await Form.findAll({
        where: { frameworkKey: { [Op.in]: this.frameworks } },
        attributes: ["id"]
      });
      const formIds = forms.map(form => form.id);

      this.builder.can(["read", "update", "delete", "uploadFiles"], FormQuestionOption, {
        formQuestionId: { $in: formIds }
      });
    }

    if (this.permissions.includes("forms-manage")) {
      this.builder.can(["read", "create", "update", "delete", "uploadFiles"], FormQuestionOption);
    }

    const user = await this.getUser();
    if (user != null) {
      const forms = await Form.findAll({
        where: { updatedBy: user.id },
        attributes: ["id"]
      });
      const formIds = forms.map(form => form.id);

      this.builder.can(["read", "update", "uploadFiles"], FormQuestionOption, {
        formQuestionId: { $in: formIds }
      });
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id"]
    }));
  }
}
