import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { Form, FormQuestion, UpdateRequest } from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import {
  EntityModel,
  EntityType,
  getOrganisationId,
  getProjectId,
  hasNothingToReport,
  isEntity,
  isReport
} from "@terramatch-microservices/database/constants/entities";
import { Dictionary } from "lodash";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isField, isFile, isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { FormModels, LinkedAnswerCollector } from "./linkedAnswerCollector";
import { FormDataDto } from "./dto/form-data.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { PolicyService } from "@terramatch-microservices/common";
import { DUE, STARTED } from "@terramatch-microservices/database/constants/status";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

@Injectable()
export class FormDataService {
  private logger = new TMLogger(FormDataService.name);

  constructor(
    private readonly localizationService: LocalizationService,
    private readonly mediaService: MediaService,
    private readonly policyService: PolicyService
  ) {}

  async storeEntityAnswers(model: EntityModel, form: Form, answers: Dictionary<unknown>) {
    const updateRequest = await UpdateRequest.for(model).current().findOne();
    if (updateRequest != null) {
      await updateRequest.update({ content: answers });
    } else if (!(await this.policyService.hasAccess("updateAnswers", model))) {
      const newUpdateRequest = await UpdateRequest.create({
        updateRequestableType: laravelType(model),
        updateRequestableId: model.id,
        createdById: authenticatedUserId(),
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

    const questions = await FormQuestion.forForm(form.uuid).findAll();

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

  private async getFormTitle(form: Form, locale: ValidLocale) {
    if (form.titleId == null) return form.title;

    const translations = await this.localizationService.translateIds([form.titleId], locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  private async updateEntityFromForm<T extends EntityModel>(model: T, form: Form, answers: Dictionary<unknown>) {
    model.answers = {};

    const questions = await FormQuestion.forForm(form.uuid).findAll();
    const collector = new LinkedAnswerCollector(this.mediaService);
    const syncPromises: Promise<void>[] = [];
    for (const question of questions) {
      if (question.inputType === "conditional") {
        model.answers[question.uuid] = answers[question.uuid];
      } else {
        const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
        if (config == null) {
          this.logger.warn("Entity question with no linked field config", { questionUuid: question.uuid });
          continue;
        }

        // Note: file questions are currently handled with direct file upload in the entity form on the FE
        const { field } = config;
        if (isField(field)) {
          syncPromises.push(collector.fields.syncField(model, question, field, answers));
        } else if (isRelation(field)) {
          syncPromises.push(
            collector[field.resource].syncRelation(
              model,
              field,
              answers[question.uuid] as object[] | null | undefined,
              question.isHidden(answers, questions)
            )
          );
        }
      }
    }
    await Promise.all(syncPromises);

    if (isReport(model)) {
      model.completion = this.calculateProgress(answers, questions);

      const isAdmin = (await this.policyService.getPermissions()).includes(`framework-${model.frameworkKey}`);
      if (model.createdBy == null && !isAdmin) {
        model.createdBy = authenticatedUserId() ?? null;
      }

      // An admin should be able to directly update a report without a transition unless it's in `due`, in which case
      // we want the transition to go ahead and take place.
      if (model.status === DUE || !isAdmin) {
        model.status = STARTED;
      }

      // This update has to happen after the status set above or moving to STARTED can fail if the
      // record is currently in AWAITING_APPROVAL.
      if (hasNothingToReport(model)) model.nothingToReport = false;
    }

    await model.save();
  }

  private calculateProgress(answers: Dictionary<unknown>, questions: FormQuestion[]) {
    let questionCount = 0;
    let answeredCount = 0;

    for (const question of questions) {
      // Ignore if the question isn't required
      if ((question.validation as Dictionary<unknown>)?.required !== true) continue;
      // Ignore if the question is hidden
      if (question.isHidden(answers, questions)) continue;

      questionCount++;
      if (answers[question.uuid] != null) answeredCount++;
    }

    return questionCount == 0 ? 100 : Math.round((answeredCount / questionCount) * 100);
  }
}
