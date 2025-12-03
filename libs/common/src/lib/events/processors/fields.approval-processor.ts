import { EntityApprovalProcessor } from "./types";
import { Form, FormQuestion } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../../util/tm-logger";
import { getLinkedFieldConfig } from "../../linkedFields";
import { isField } from "@terramatch-microservices/database/constants/linked-fields";
import { fieldCollector } from "../../linkedFields/linkedAnswerCollector/field.collector";

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
    const collector = fieldCollector(logger);
    await Promise.all(
      questions.map(async question => {
        if (question.linkedFieldKey == null || !question.isHidden(entity.answers ?? {}, questions)) return;

        const field = getLinkedFieldConfig(question.linkedFieldKey)?.field;
        if (field == null || !isField(field)) return;

        await collector.syncField(entity, question, field, { [question.uuid]: null });
      })
    );

    await entity.save();
  }
};
