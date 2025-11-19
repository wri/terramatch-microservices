import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  DisturbanceReport,
  FinancialReport,
  Form,
  FormQuestion,
  FormSection,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import {
  EntityModel,
  EntityType,
  getOrganisationId,
  getProjectId,
  isEntity
} from "@terramatch-microservices/database/constants/entities";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isField, isFile, isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { FormModels, LinkedAnswerCollector } from "./linkedAnswerCollector";
import { FormDataDto } from "./dto/form-data.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { PolicyService } from "@terramatch-microservices/common";

@Injectable()
export class FormDataService {
  private logger = new TMLogger(FormDataService.name);

  constructor(
    private readonly localizationService: LocalizationService,
    private readonly mediaService: MediaService,
    private readonly policyService: PolicyService
  ) {}

  async getForm(model: EntityModel) {
    if (model instanceof FinancialReport) {
      return await Form.findOne({ where: { type: "financial-report" } });
    }
    if (model instanceof DisturbanceReport) {
      return await Form.findOne({ where: { type: "disturbance-report" } });
    }

    return await Form.findOne({ where: { model: laravelType(model), frameworkKey: model.frameworkKey } });
  }

  async storeEntityAnswers(model: EntityModel, form: Form, answers: object) {
    const updateRequest = await UpdateRequest.for(model).current().findOne();
    if (updateRequest != null) {
      await updateRequest.update({ content: answers });
    } else if (!(await this.policyService.hasAccess("updateAnswers", model))) {
      const newUpdateRequest = await UpdateRequest.create({
        updateRequestableType: laravelType(model),
        updateRequestableId: model.id,
        createdById: this.policyService.userId,
        frameworkKey: model.frameworkKey,
        content: answers,
        projectId: await getProjectId(model),
        organisationId: await getOrganisationId(model)
      } as UpdateRequest);
      model.updateRequestStatus = newUpdateRequest.status;
      await model.save();
    } else {
      await this.updateEntityFromForm(model, form, answers);
    }
  }

  async getFormTitle(form: Form, locale: ValidLocale) {
    const ids = form.titleId == null ? [] : [form.titleId];
    const translations = await this.localizationService.translateIds(ids, locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  async getDtoForEntity(entityType: EntityType, entity: EntityModel, form: Form, locale: ValidLocale) {
    const formTitle = await this.getFormTitle(form, locale);
    const currentUpdateRequest = await UpdateRequest.for(entity)
      .current()
      .findOne({ attributes: ["uuid", "content", "feedback", "feedbackFields"] });
    const hasURFeedback = currentUpdateRequest?.feedback != null || currentUpdateRequest?.feedbackFields != null;
    const { feedback, feedbackFields } = hasURFeedback ? currentUpdateRequest : entity;
    const answers = currentUpdateRequest?.content ?? (await this.getAnswers(form, { [entityType]: entity }));
    return populateDto(new FormDataDto(), {
      entityType,
      entityUuid: entity.uuid,
      formUuid: form.uuid,
      formTitle,
      frameworkKey: entity.frameworkKey,
      feedback,
      feedbackFields,
      answers
    });
  }

  async getAnswers(form: Form, models: FormModels, answersModel?: { answers: object | null }) {
    const answers: Dictionary<unknown> = {};
    if (answersModel == null) {
      const modelValues = Object.values(models);
      if (modelValues.length !== 1) {
        throw new InternalServerErrorException("Expected exactly one model if no answers model is provided");
      }
      if (!isEntity(modelValues[0])) {
        throw new InternalServerErrorException("Expected entity model if no answers model is provided");
      }
      answersModel = modelValues[0];
    }
    const modelAnswers = answersModel?.answers ?? {};

    const questions = await FormQuestion.findAll({
      where: { formSectionId: { [Op.in]: FormSection.forForm(form.uuid) } }
    });

    const collector = new LinkedAnswerCollector(this.mediaService);
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        answers[question.uuid] = modelAnswers?.[question.uuid];
      } else {
        if (isField(config.field)) collector.fields.addField(config.field, config.model, question.uuid);
        else if (isFile(config.field)) collector.files.addField(config.field, config.model, question.uuid);
        else if (isRelation(config.field)) {
          collector[config.field.resource].addField(config.field, config.model, question.uuid);
        }
      }
    }

    await collector.collect(answers, models);

    return answers;
  }

  private async updateEntityFromForm<T extends EntityModel>(model: T, form: Form, answers: object) {
    model.answers = {};

    const questions = await FormQuestion.findAll({
      where: { formSectionId: { [Op.in]: FormSection.forForm(form.uuid) } }
    });
    const collector = new LinkedAnswerCollector(this.mediaService);
    for (const question of questions) {
      if (question.inputType === "conditional") {
        model.answers[question.uuid] = answers[question.uuid];
      } else {
        const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
        if (config == null) {
          this.logger.warn("Entity question with no linked field config", { questionUuid: question.uuid });
          continue;
        }

        // Note: file questions are currently handled with directly file upload in the entity form on the FE
        const { field } = config;
        if (isField(field)) {
          const value = answers[question.uuid];
          const isDate = question.inputType === "date" && question.validation?.["required"] !== true;
          if (value != null || isDate) {
            if (
              // TODO: Look for a better way to handle this case.
              // Special case added in the v2 BE in TM-2042
              question.linkedFieldKey === "pro-rep-landscape-com-con" &&
              question.parentId != null &&
              answers[question.parentId] === true
            ) {
              model[field.property] = "";
            } else {
              model[field.property] = value;
            }
          }
        } else if (isRelation(field)) {
          const hidden =
            question.parentId != null &&
            question.showOnParentCondition === true &&
            answers[question.parentId] === false;
          await collector[field.resource].syncRelation(model, field, answers[question.uuid], hidden);
        }
      }
    }
  }
}
