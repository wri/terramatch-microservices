import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  Form,
  FormQuestion,
  FormSubmission,
  FundingProgramme,
  I18nTranslation,
  Media,
  Stage,
  UpdateRequest,
  User
} from "@terramatch-microservices/database/entities";
import { AnswersModel, laravelType } from "@terramatch-microservices/database/types/util";
import {
  EntityModel,
  EntityType,
  FormModel,
  formModelType,
  getOrganisationId,
  getProjectId,
  hasNothingToReport,
  isEntity,
  isReport
} from "@terramatch-microservices/database/constants/entities";
import { Dictionary, flatten, isEmpty, uniq } from "lodash";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { isField, isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { FormModels, LinkedAnswerCollector } from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import { FormDataDto } from "./dto/form-data.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { PolicyService } from "@terramatch-microservices/common";
import { DUE, STARTED } from "@terramatch-microservices/database/constants/status";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { SubmissionDto } from "./dto/submission.dto";
import { Op } from "sequelize";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { FundingProgrammeDto, StageDto } from "../fundingProgrammes/dto/funding-programme.dto";
import { EmbeddedMediaDto } from "@terramatch-microservices/common/dto/media.dto";

@Injectable()
export class FormDataService {
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
      await this.updateModelFromForm(model, form, answers);
    }
  }

  async storeSubmissionAnswers(submission: FormSubmission, form: Form, answers: Dictionary<unknown>) {
    const models: FormModels = {
      organisations:
        submission.organisation ??
        (submission.organisationUuid == null ? undefined : await submission.$get("organisation")) ??
        undefined,
      projectPitches:
        submission.projectPitch ??
        (submission.projectPitchUuid == null ? undefined : await submission.$get("projectPitch")) ??
        undefined
    };

    if (models.organisations == null || models.projectPitches == null) {
      throw new InternalServerErrorException("Submission must have an organisation and project pitch");
    }

    await this.updateModelFromForm(submission, form, answers, models);
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

  /**
   * Returns a FormSubmission with all the associations needed to fill out the SubmissionDto
   */
  async getFullSubmission(uuid: string) {
    return await FormSubmission.findOne({
      where: { uuid },
      include: [
        { association: "form" },
        { association: "application", attributes: ["uuid"] },
        { association: "organisation" },
        { association: "projectPitch" },
        { association: "stage", attributes: ["name"] },
        { association: "user", attributes: ["firstName", "lastName"] }
      ]
    });
  }

  async addSubmissionDto(document: DocumentBuilder, formSubmission: FormSubmission, form?: Form, locale?: ValidLocale) {
    form ??=
      formSubmission.form ??
      (formSubmission.formId == null ? undefined : await Form.findOne({ where: { uuid: formSubmission.formId } })) ??
      undefined;
    if (form == null) throw new BadRequestException("Form not found for submission");

    locale ??= (await User.findLocale(authenticatedUserId())) ?? "en-US";

    formSubmission.organisation ??= (await formSubmission.$get("organisation")) ?? null;
    formSubmission.projectPitch ??= (await formSubmission.$get("projectPitch")) ?? null;
    if (formSubmission.organisation == null || formSubmission.projectPitch == null) {
      throw new NotFoundException("Submission is missing the organisation or project pitch.");
    }

    const answers = await this.getAnswers(
      form,
      {
        organisations: formSubmission.organisation,
        projectPitches: formSubmission.projectPitch
      },
      formSubmission
    );

    const i18nItemIds = isEmpty(formSubmission.feedbackFields)
      ? []
      : (
          await I18nTranslation.findAll({
            where: {
              [Op.or]: {
                shortValue: formSubmission.feedbackFields,
                longValue: formSubmission.feedbackFields
              }
            },
            attributes: ["i18nItemId"]
          })
        ).map(({ i18nItemId }) => i18nItemId);
    const translations = await this.localizationService.translateIds(i18nItemIds, locale);

    document.addData(
      formSubmission.uuid,
      new SubmissionDto(formSubmission, {
        answers,
        frameworkKey: form?.frameworkKey,
        translatedFeedbackFields: Object.values(translations).filter(isNotNull)
      })
    );

    return document;
  }

  async addFundingProgrammeDtos(
    document: DocumentBuilder,
    fundingProgrammes: FundingProgramme[],
    locale?: ValidLocale
  ) {
    const translationIds = uniq(
      flatten(
        fundingProgrammes.map(({ nameId, descriptionId, locationId }) => [nameId, descriptionId, locationId])
      ).filter(isNotNull)
    );
    const translations = locale == null ? {} : await this.localizationService.translateIds(translationIds, locale);
    const coverMedias = await Media.for(fundingProgrammes).findAll({
      where: { collectionName: "cover" },
      order: [["createdAt", "DESC"]]
    });

    const allStages = await Stage.findAll({
      where: { fundingProgrammeId: fundingProgrammes.map(({ uuid }) => uuid) },
      attributes: ["uuid", "fundingProgrammeId", "name", "deadlineAt"],
      order: [["order", "ASC"]]
    });
    const stageForms = await Form.findAll({
      where: { stageId: allStages.map(({ uuid }) => uuid) },
      attributes: ["uuid", "stageId"]
    });

    for (const fundingProgramme of fundingProgrammes) {
      const programStages = allStages.filter(({ fundingProgrammeId }) => fundingProgrammeId === fundingProgramme.uuid);
      const stages = programStages.map(({ name, deadlineAt, uuid }) => {
        const formUuid = stageForms.find(({ stageId }) => stageId === uuid)?.uuid ?? null;
        return populateDto(new StageDto(), { uuid, name, deadlineAt, formUuid });
      });
      const coverMedia = coverMedias.find(({ modelId }) => modelId === fundingProgramme.id);
      document.addData(
        fundingProgramme.uuid,
        new FundingProgrammeDto(fundingProgramme, {
          ...this.localizationService.translateFields(translations, fundingProgramme, [
            "name",
            "description",
            "location"
          ]),
          cover:
            coverMedia == null
              ? null
              : new EmbeddedMediaDto(coverMedia, {
                  url: this.mediaService.getUrl(coverMedia),
                  thumbUrl: this.mediaService.getUrl(coverMedia, "thumbnail")
                }),
          stages
        })
      );
    }

    return document;
  }

  async getAnswers(form: Form, models: FormModels, answersModel?: { answers: Dictionary<unknown> | null }) {
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

    const questions = await FormQuestion.forForm(form.uuid).findAll();
    const collector = new LinkedAnswerCollector(this.mediaService);
    return await collector.getAnswers(answersModel?.answers ?? {}, questions, models);
  }

  private async getFormTitle(form: Form, locale: ValidLocale) {
    if (form.titleId == null) return form.title;

    const translations = await this.localizationService.translateIds([form.titleId], locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  async updateModelFromForm<T extends AnswersModel>(
    answersModel: T,
    form: Form,
    answers: Dictionary<unknown>,
    associatedModels: FormModels = {}
  ) {
    answersModel.answers = {};
    const type = formModelType(answersModel as unknown as FormModel);
    const models: FormModels = type == null ? associatedModels : { [type]: answersModel, ...associatedModels };

    const questions = await FormQuestion.forForm(form.uuid).findAll();
    const collector = new LinkedAnswerCollector(this.mediaService);
    const syncPromises: Promise<void>[] = [];
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        answersModel.answers[question.uuid] = answers[question.uuid];
        continue;
      }

      const model = models[config.model];
      if (model == null) throw new InternalServerErrorException(`Missing model for linked field ${config.model}`);

      // Note: file questions are currently handled with direct file upload in the entity form on the FE
      if (isField(config.field)) {
        syncPromises.push(collector.fields.syncField(model, question, config.field, answers));
      } else if (isRelation(config.field)) {
        syncPromises.push(
          collector[config.field.resource].syncRelation(
            model,
            config.field,
            answers[question.uuid] as object[] | null | undefined,
            question.isHidden(answers, questions)
          )
        );
      }
    }
    await Promise.all(syncPromises);

    if (isReport(answersModel)) {
      answersModel.completion = this.calculateProgress(answers, questions);

      const permissions = await this.policyService.getPermissions();
      const { frameworkKey } = answersModel;
      const isAdmin =
        frameworkKey == null
          ? permissions.find(permission => permission.startsWith("framework-")) != null
          : permissions.includes(`framework-${answersModel.frameworkKey}`);
      if (answersModel.createdBy == null && !isAdmin) {
        answersModel.createdBy = authenticatedUserId() ?? null;
      }

      // An admin should be able to directly update a report without a transition unless it's in `due`, in which case
      // we want the transition to go ahead and take place.
      if (answersModel.status === DUE || !isAdmin) {
        answersModel.status = STARTED;
      }

      // This update has to happen after the status set above or moving to STARTED can fail if the
      // record is currently in AWAITING_APPROVAL.
      if (hasNothingToReport(answersModel)) answersModel.nothingToReport = false;
    }

    await Promise.all([answersModel, ...Object.values(models)].map(model => model.save()));
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
