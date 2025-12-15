import { Injectable, NotFoundException, Scope } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  Form,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  Media,
  Stage,
  User
} from "@terramatch-microservices/database/entities";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { Dictionary, difference, filter, flatten, flattenDeep, groupBy, sortBy, union, uniq } from "lodash";
import { FormFullDto, FormLightDto, StoreFormAttributes } from "./dto/form.dto";
import { FormSectionDto, StoreFormSectionAttributes } from "./dto/form-section.dto";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import {
  FormQuestionDto,
  FormQuestionOptionDto,
  StoreFormQuestionAttributes,
  StoreFormQuestionOptionAttributes
} from "./dto/form-question.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Attributes, Op } from "sequelize";
import { FormIndexQueryDto } from "./dto/form-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import {
  acceptMimeTypes,
  MEDIA_OWNER_TYPES,
  MediaOwnerType
} from "@terramatch-microservices/database/constants/media-owners";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { LinkedFile } from "@terramatch-microservices/database/constants/linked-fields";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

const SORTABLE_FIELDS: (keyof Attributes<Form>)[] = ["title", "type"];
const SIMPLE_FILTERS: (keyof FormIndexQueryDto)[] = ["type"];

@Injectable({ scope: Scope.REQUEST })
export class FormsService {
  private readonly logger = new TMLogger(FormsService.name);

  constructor(private readonly localizationService: LocalizationService, private readonly mediaService: MediaService) {}

  async findOne(uuid: string) {
    const form = await Form.findOne({
      where: { uuid },
      include: [{ association: "stage", attributes: ["fundingProgrammeId"] }]
    });
    if (form == null) throw new NotFoundException("Form not found");

    return form;
  }

  async findMany(query: FormIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Form, query.page);

    if (query.sort?.field != null) {
      if (SORTABLE_FIELDS.includes(query.sort?.field as keyof Attributes<Form>)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort?.field}`);
      }
    }

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) builder.where({ [term]: query[term] });
    }

    if (query.search != null) {
      builder.where({ title: { [Op.like]: `%${query.search}%` } });
    }

    return { forms: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addIndex(document: DocumentBuilder, query: FormIndexQueryDto) {
    const { forms, paginationTotal } = await this.findMany(query);
    const bannerMediaByFormId =
      forms.length == 0
        ? {}
        : groupBy(
            await Media.for(forms).findAll({ where: { collectionName: "banner" }, order: [["createdAt", "DESC"]] }),
            "modelId"
          );

    for (const form of forms) {
      const banner = bannerMediaByFormId[form.id]?.[0];
      document.addData(
        form.uuid,
        new FormLightDto(form, {
          title: form.title,
          banner:
            banner == null
              ? null
              : new MediaDto(banner, {
                  url: this.mediaService.getUrl(banner),
                  thumbUrl: this.mediaService.getUrl(banner, "thumbnail"),
                  entityType: "forms",
                  entityUuid: form.uuid
                })
        })
      );
    }

    return document.addIndex({
      requestPath: `/forms/v3${getStableRequestQuery(query)}`,
      total: paginationTotal,
      pageNumber: query.page?.number ?? 1
    });
  }

  async addFullDto(document: DocumentBuilder, form: Form, translated: boolean): Promise<DocumentBuilder> {
    // Note: Fetching the sections / questions / table headers as their own queries is substantially
    // more efficient than joining these large tables together into the form query above.
    // Note: Form / section / question relations are odd - form_sections.form_id is the form uuid, but
    // form questions and form table headers relate to their parents via numerical ID.
    const sections = await FormSection.findAll({ where: { formId: form.uuid } });
    const questions = await FormQuestion.findAll({ where: { formSectionId: sections.map(({ id }) => id) } });
    const tableHeaders = await FormTableHeader.findAll({ where: { formQuestionId: questions.map(({ id }) => id) } });
    const options = await FormQuestionOption.findAll({ where: { formQuestionId: questions.map(({ id }) => id) } });
    const optionsImages =
      options.length == 0 ? [] : await Media.for(options).findAll({ where: { collectionName: "image" } });

    const translations = translated
      ? await this.getTranslationsForFullDto(form, sections, questions, tableHeaders, options)
      : {};

    const tableHeadersByQuestionId = groupBy(tableHeaders, "formQuestionId");
    const optionsByQuestionId = groupBy(options, "formQuestionId");
    const optionMediaByOptionId = optionsImages.reduce(
      (map, media) => ({
        ...map,
        [media.modelId]: {
          url: this.mediaService.getUrl(media),
          thumbUrl: this.mediaService.getUrl(media, "thumbnail")
        }
      }),
      {} as Record<number, { url: string | null; thumbUrl: string | null }>
    );

    const questionToDto = (question: FormQuestion, sectionQuestions: FormQuestion[] = []) => {
      const config = getLinkedFieldConfig(question.linkedFieldKey ?? "");
      // For file questions, the collection is the collection of the field.
      const collection =
        (question.inputType === "file" ? (config?.field as LinkedFile | undefined)?.collection : question.collection) ??
        null;
      const childQuestions = sectionQuestions.filter(({ parentId }) => parentId === question.uuid);
      const options = optionsByQuestionId[question.id];
      const tableHeaders = tableHeadersByQuestionId[question.id];
      return new FormQuestionDto(question, {
        name: question.uuid,
        model: config?.model ?? null,
        collection,
        ...this.localizationService.translateFields(translations, question, ["label", "description", "placeholder"]),
        tableHeaders:
          tableHeaders == null
            ? null
            : sortBy(tableHeaders, "order").map(
                header => this.localizationService.translateFields(translations, header, ["label"]).label
              ),
        options:
          options == null
            ? null
            : sortBy(options, "order").map(option =>
                populateDto<FormQuestionOptionDto>(new FormQuestionOptionDto(), {
                  id: option.uuid,
                  slug: option.slug ?? "",
                  imageUrl: optionMediaByOptionId[option.id]?.url ?? option.imageUrl,
                  thumbUrl: optionMediaByOptionId[option.id]?.thumbUrl ?? null,
                  ...this.localizationService.translateFields(translations, option, ["label"]),
                  altValue: null
                })
              ),
        children: childQuestions.length === 0 ? null : childQuestions.map(child => questionToDto(child))
      });
    };

    const sectionToDto = (section: FormSection) => {
      const sectionQuestions = sortBy(
        questions.filter(({ formSectionId }) => formSectionId === section.id),
        "order"
      );

      return new FormSectionDto(section, {
        id: section.uuid,
        ...this.localizationService.translateFields(translations, section, ["title", "description"]),
        questions: sectionQuestions
          .filter(({ parentId }) => parentId == null)
          .map(question => questionToDto(question, sectionQuestions))
      });
    };

    const bannerMedia = await Media.for(form).findOne({
      where: { collectionName: "banner" },
      order: [["createdAt", "DESC"]]
    });
    document.addData<FormFullDto>(
      form.uuid,
      new FormFullDto(form, {
        translated,
        ...this.localizationService.translateFields(translations, form, [
          "title",
          "subtitle",
          "description",
          "submissionMessage"
        ]),
        fundingProgrammeId: form.stage?.fundingProgrammeId ?? null,
        banner:
          bannerMedia == null
            ? null
            : new MediaDto(bannerMedia, {
                url: this.mediaService.getUrl(bannerMedia),
                thumbUrl: this.mediaService.getUrl(bannerMedia, "thumbnail"),
                entityType: "forms",
                entityUuid: form.uuid
              }),
        sections: sortBy(sections, "order").map(sectionToDto)
      })
    );

    return document;
  }

  async store(attributes: StoreFormAttributes, form = new Form()) {
    await this.storeForm(form, attributes);
    return form;
  }

  private _userLocale?: ValidLocale;
  private async getUserLocale() {
    if (this._userLocale == null) {
      const userId = authenticatedUserId();
      this._userLocale = userId == null ? undefined : await User.findLocale(userId);
      if (this._userLocale == null) {
        throw new BadRequestException("Locale is required");
      }
    }
    return this._userLocale;
  }

  private async getTranslationsForFullDto(
    form: Form,
    sections: FormSection[],
    questions: FormQuestion[],
    tableHeaders: FormTableHeader[],
    options: FormQuestionOption[]
  ) {
    // Get all the translations at once.
    const formI18nIds = [form.titleId, form.subtitleId, form.descriptionId, form.submissionMessageId];
    const sectionI18nIds = sections.map(({ titleId, descriptionId }) => [titleId, descriptionId]);
    const questionI18nIds = questions.map(({ labelId, descriptionId, placeholderId }) => [
      labelId,
      descriptionId,
      placeholderId
    ]);
    const tableHeaderI18nIds = tableHeaders.map(({ labelId }) => labelId);
    const optionI18nIds = options.map(({ labelId }) => labelId);
    return await this.localizationService.translateIds(
      filter(
        uniq(flattenDeep([formI18nIds, sectionI18nIds, questionI18nIds, tableHeaderI18nIds, optionI18nIds])),
        isNotNull
      ),
      await this.getUserLocale()
    );
  }

  private async storeForm(form: Form, attributes: StoreFormAttributes) {
    // Note: this field is a char(32) in the DB which would normally be a UUID, but the current
    // rows are all numerical IDs.
    form.updatedBy = `${authenticatedUserId()}`;
    form.title = attributes.title;
    form.titleId = await this.localizationService.generateI18nId(attributes.title, form.titleId);
    form.subtitle = attributes.subtitle ?? null;
    form.subtitleId = await this.localizationService.generateI18nId(attributes.subtitle, form.subtitleId);
    form.frameworkKey = attributes.frameworkKey ?? null;
    form.type = attributes.type ?? null;
    form.description = attributes.description ?? null;
    form.descriptionId = await this.localizationService.generateI18nId(attributes.description, form.descriptionId);
    form.documentation = attributes.documentation ?? null;
    form.documentationLabel = attributes.documentationLabel ?? null;
    form.deadlineAt = attributes.deadlineAt ?? null;
    form.submissionMessage = attributes.submissionMessage;
    form.submissionMessageId = await this.localizationService.generateI18nId(
      attributes.submissionMessage,
      form.submissionMessageId
    );
    form.stageId = attributes.stageId ?? null;
    // attach the stage for the full form DTO
    form.stage =
      attributes.stageId == null
        ? null
        : await Stage.findOne({ where: { uuid: attributes.stageId }, attributes: ["fundingProgrammeId"] });
    form.version = attributes.stageId == null ? 1 : (await Form.count({ where: { stageId: attributes.stageId } })) + 1;
    // Newly created forms are always unpublished
    form.published = form.id == null ? false : attributes.published;
    await form.save();

    const currentSections = await FormSection.findAll({ where: { formId: form.uuid } });
    const updateSections = await Promise.all(
      (attributes.sections ?? []).map((section, index) => this.storeSection(form.uuid, section, index, currentSections))
    );

    const currentIds = currentSections.map(({ id }) => id);
    const updateIds = updateSections.map(({ id }) => id);
    const removed = difference(currentIds, updateIds);
    if (removed.length > 0) {
      await FormSection.destroy({ where: { id: { [Op.in]: removed } } });
      await FormQuestion.destroy({ where: { formSectionId: { [Op.in]: removed } } });
    }
  }

  private async storeSection(
    formUuid: string,
    attributes: StoreFormSectionAttributes,
    order: number,
    currentSections: FormSection[]
  ) {
    const section = currentSections.find(({ uuid }) => uuid === attributes.id) ?? new FormSection();
    section.formId = formUuid;
    section.order = order;
    section.title = attributes.title ?? null;
    section.titleId = await this.localizationService.generateI18nId(attributes.title, section.titleId);
    section.description = attributes.description ?? null;
    section.descriptionId = await this.localizationService.generateI18nId(
      attributes.description,
      section.descriptionId
    );
    await section.save();

    const currentQuestions = await FormQuestion.findAll({ where: { formSectionId: section.id } });
    const updateQuestions = flatten(
      await Promise.all(
        (attributes.questions ?? []).map((question, index) =>
          this.storeQuestion(section.id, question, index, currentQuestions)
        )
      )
    );
    const currentIds = currentSections.map(({ id }) => id);
    const updateIds = updateQuestions.map(({ id }) => id);
    if (union(currentIds, updateIds).length !== updateIds.length) {
      // We don't need hooks here because this will catch child questions.
      await FormQuestion.destroy({ where: { formSectionId: section.id, id: { [Op.notIn]: updateIds } } });
    }

    return section;
  }

  private async storeQuestion(
    sectionId: number,
    attributes: StoreFormQuestionAttributes,
    order: number,
    currentQuestions: FormQuestion[],
    parentUuid?: string
  ): Promise<FormQuestion[]> {
    const question = currentQuestions.find(({ uuid }) => uuid === attributes.name) ?? new FormQuestion();
    question.formSectionId = sectionId;
    question.order = order;
    question.parentId = parentUuid ?? null;
    question.linkedFieldKey = attributes.linkedFieldKey ?? null;
    question.inputType = attributes.inputType;
    question.label = attributes.label;
    question.labelId = await this.localizationService.generateI18nId(attributes.label, question.labelId);
    question.name = attributes.name ?? null;
    question.placeholder = attributes.placeholder ?? null;
    question.placeholderId = await this.localizationService.generateI18nId(
      attributes.placeholder,
      question.placeholderId
    );
    question.description = attributes.description ?? null;
    question.descriptionId = await this.localizationService.generateI18nId(
      attributes.description,
      question.descriptionId
    );
    question.validation = attributes.validation ?? null;
    question.additionalProps = this.getAdditionalProps(attributes);
    question.optionsOther = attributes.optionsOther ?? null;
    question.multiChoice = attributes.multiChoice ?? false;
    question.collection = attributes.collection ?? null;
    question.optionsList = attributes.optionsList ?? null;
    question.showOnParentCondition = attributes.showOnParentCondition ?? null;
    question.years = attributes.years ?? null;
    question.minCharacterLimit = attributes.minCharacterLimit ?? null;
    question.maxCharacterLimit = attributes.maxCharacterLimit ?? null;
    await question.save();

    if (question.inputType === "tableInput" && attributes.tableHeaders != null) {
      const currentHeaders = await FormTableHeader.findAll({ where: { formQuestionId: question.id } });
      const updateHeaders = await Promise.all(
        attributes.tableHeaders.map(async (label, index) => {
          const header = currentHeaders.find(current => current.label === label) ?? new FormTableHeader();
          header.formQuestionId = question.id;
          header.label = label;
          header.labelId = await this.localizationService.generateI18nId(label, header.labelId);
          header.order = index;
          await header.save();
          return header;
        })
      );
      const currentIds = currentHeaders.map(({ id }) => id);
      const updateIds = updateHeaders.map(({ id }) => id);
      if (union(currentIds, updateIds).length !== updateIds.length) {
        await FormTableHeader.destroy({ where: { formQuestionId: question.id, id: { [Op.notIn]: updateIds } } });
      }
    }

    if (attributes.options != null) {
      const currentOptions = await FormQuestionOption.findAll({ where: { formQuestionId: question.id } });
      const updateOptions = await Promise.all(
        (attributes.options ?? []).map((option, index) =>
          this.storeFormQuestionOption(question.id, option, index, currentOptions)
        )
      );
      const currentIds = currentOptions.map(({ id }) => id);
      const updateIds = updateOptions.map(({ id }) => id);
      if (union(currentIds, updateIds).length !== updateIds.length) {
        await FormQuestionOption.destroy({ where: { formQuestionId: question.id, id: { [Op.notIn]: updateIds } } });
      }
    }

    const children = flatten(
      await Promise.all(
        (attributes.children ?? []).map((child, index) =>
          this.storeQuestion(sectionId, child, index, currentQuestions, question.uuid)
        )
      )
    );

    return [question, ...children];
  }

  private async storeFormQuestionOption(
    questionId: number,
    attributes: StoreFormQuestionOptionAttributes,
    order: number,
    currentOptions: FormQuestionOption[]
  ) {
    const option = currentOptions.find(({ slug }) => slug === attributes.slug) ?? new FormQuestionOption();
    option.formQuestionId = questionId;
    option.order = order;
    option.slug = attributes.slug;
    option.label = attributes.label;
    option.labelId = await this.localizationService.generateI18nId(attributes.label, option.labelId);
    option.imageUrl = attributes.imageUrl ?? null;
    await option.save();
    return option;
  }

  private getAdditionalProps(attributes: StoreFormQuestionAttributes) {
    const additionalProps: Dictionary<string | boolean | object | string[] | undefined> = {
      ...attributes.additionalProps
    };

    if (attributes.inputType === "file" && attributes.linkedFieldKey != null) {
      const config = getLinkedFieldConfig(attributes.linkedFieldKey);
      if (config == null) return additionalProps;

      if (!MEDIA_OWNER_TYPES.includes(config.model as MediaOwnerType)) {
        this.logger.error(`Linked field model is not a media owner: ${config.model}`);
        return additionalProps;
      }

      additionalProps.accept = acceptMimeTypes(config.model as MediaOwnerType, (config.field as LinkedFile).collection);
    }

    return additionalProps;
  }
}
