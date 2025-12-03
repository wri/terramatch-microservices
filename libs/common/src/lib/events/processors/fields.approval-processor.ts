import { EntityApprovalProcessor } from "./types";
import { Form, FormQuestion } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../../util/tm-logger";
import { getLinkedFieldConfig } from "../../linkedFields";
import { isField, isPropertyField } from "@terramatch-microservices/database/constants/linked-fields";

const logger = new TMLogger("FieldsApprovalProcessor");

export const FieldsApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    const form = await Form.for(entity).findOne({ attributes: ["uuid"] });
    if (form == null) {
      logger.error(`No form found for [${entity.constructor.name}, ${entity.id}`);
      return;
    }
    const questions = await FormQuestion.forForm(form.uuid).findAll();

    // Null out the answers to any fields that are hidden by a parent condition.
    for (const question of questions) {
      if (question.linkedFieldKey == null || !question.isHidden(entity.answers ?? {}, questions)) continue;

      const field = getLinkedFieldConfig(question.linkedFieldKey)?.field;
      if (field == null || !isField(field) || !isPropertyField(field)) continue;

      entity[field.property] = null;
    }

    await entity.save();
  }
};
