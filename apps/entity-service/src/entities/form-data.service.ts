import { Injectable } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  DisturbanceReport,
  FinancialReport,
  Form,
  FormQuestion,
  FormSection,
  ProjectPolygon
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { getLinkedFieldConfig, LinkedFieldSpecification } from "@terramatch-microservices/common/linkedFields";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isField, isFile, isRelation } from "@terramatch-microservices/database/constants/linked-fields";

@Injectable()
export class FormDataService {
  private logger = new TMLogger(FormDataService.name);

  constructor(private readonly localizationService: LocalizationService) {}

  async getForm(model: EntityModel) {
    if (model instanceof FinancialReport) {
      return await Form.findOne({ where: { type: "financial-report" } });
    }
    if (model instanceof DisturbanceReport) {
      return await Form.findOne({ where: { type: "disturbance-report" } });
    }

    return await Form.findOne({ where: { model: laravelType(model), frameworkKey: model.frameworkKey } });
  }

  async getFormTitle(form: Form, locale: ValidLocale) {
    const ids = form.titleId == null ? [] : [form.titleId];
    const translations = await this.localizationService.translateIds(ids, locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  async getAnswers(form: Form, model: EntityModel) {
    const answers: Dictionary<unknown> = {};
    const modelAnswers = model.answers;

    const questions = await FormQuestion.findAll({
      where: { formSectionId: { [Op.in]: FormSection.forForm(form.uuid) } }
    });
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        answers[question.uuid] = modelAnswers?.[question.uuid];
      } else {
        answers[question.uuid] = await this.getAnswer(config, model);
      }
    }

    return answers;
  }

  async getAnswer({ model: modelType, field: spec }: LinkedFieldSpecification, model: EntityModel) {
    if (isField(spec)) {
      if (spec.inputType === "mapInput" || spec.property === "proj_boundary") {
        return (
          await ProjectPolygon.findOne({
            where: { entityType: laravelType(model), entityId: model.id },
            order: [["createdAt", "DESC"]],
            include: ["polygon"]
          })
        )?.polygon;
      } else {
        return model[spec.property];
      }
    } else if (isFile(spec)) {
      // TODO
    } else if (isRelation(spec)) {
      // TODO
    } else {
      return undefined;
    }
  }
}
