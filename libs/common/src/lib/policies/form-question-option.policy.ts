import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FormQuestionOption, Form, FormQuestion, FormSection } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

export class FormQuestionOptionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      const formQuestion = await FormQuestion.findAll({
        include: [
          {
            model: FormSection,
            required: true,
            include: [
              {
                model: Form,
                required: true,
                where: {
                  frameworkKey: { [Op.in]: this.frameworks }
                },
                attributes: []
              }
            ],
            attributes: []
          }
        ],
        attributes: ["id"]
      });

      const formQuestionsIds = formQuestion.map(q => q.id);
      if (formQuestionsIds.length > 0) {
        this.builder.can(["uploadFiles"], FormQuestionOption, {
          formQuestionId: { $in: formQuestionsIds }
        });
      }
    }
  }
}
