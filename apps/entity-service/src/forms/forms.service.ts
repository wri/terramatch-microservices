import { Injectable, NotFoundException, Scope } from "@nestjs/common";
import { LocalizationService, Translations } from "@terramatch-microservices/common/localization/localization.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { RequestContext } from "nestjs-request-context";
import {
  Form,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  Media,
  User
} from "@terramatch-microservices/database/entities";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { filter, flattenDeep, groupBy, sortBy, uniq } from "lodash";
import { StoreFormAttributes, FormFullDto, FormLightDto } from "./dto/form.dto";
import { FormSectionDto, StoreFormSectionAttributes } from "./dto/form-section.dto";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import {
  FormQuestionDto,
  FormQuestionOptionDto,
  StoreFormQuestionOptionAttributes,
  StormFormQuestionAttributes
} from "./dto/form-question.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Attributes, Model, Op } from "sequelize";
import { FormIndexQueryDto } from "./dto/form-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

const SORTABLE_FIELDS: (keyof Attributes<Form>)[] = ["title", "type"];
const SIMPLE_FILTERS: (keyof FormIndexQueryDto)[] = ["type"];

@Injectable({ scope: Scope.REQUEST })
export class FormsService {
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
        : groupBy(await Media.for(forms).findAll({ where: { collectionName: "banner" } }), "modelId");

    for (const form of forms) {
      const banner = bannerMediaByFormId[form.id]?.[0];
      document.addData(
        form.uuid,
        new FormLightDto(form, {
          title: form.title,
          bannerUrl: banner == null ? null : this.mediaService.getUrl(banner)
        })
      );
    }

    return document.addIndex({
      requestPath: `/forms/v3/forms${getStableRequestQuery(query)}`,
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
      // For file questions, the collection is the property of the field.
      const collection = (question.inputType === "file" ? config?.field.property : question.collection) ?? null;
      const childQuestions = sectionQuestions.filter(({ parentId }) => parentId === question.uuid);
      const options = optionsByQuestionId[question.id];
      const tableHeaders = tableHeadersByQuestionId[question.id];
      return new FormQuestionDto(question, {
        name: question.uuid,
        model: config?.model ?? null,
        collection,
        ...this.translateFields(translations, question, ["label", "description", "placeholder"]),
        tableHeaders:
          tableHeaders == null
            ? null
            : sortBy(tableHeaders, "order").map(header => this.translateFields(translations, header, ["label"]).label),
        options:
          options == null
            ? null
            : sortBy(options, "order").map(option =>
                populateDto<FormQuestionOptionDto>(new FormQuestionOptionDto(), {
                  id: option.uuid,
                  slug: option.slug ?? "",
                  imageUrl: optionMediaByOptionId[option.id]?.url ?? option.imageUrl,
                  thumbUrl: optionMediaByOptionId[option.id]?.thumbUrl ?? null,
                  ...this.translateFields(translations, option, ["label"]),
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
        ...this.translateFields(translations, section, ["title", "description"]),
        questions: sectionQuestions
          .filter(({ parentId }) => parentId == null)
          .map(question => questionToDto(question, sectionQuestions))
      });
    };

    const bannerMedia = await Media.for(form).findOne({ where: { collectionName: "banner" } });
    document.addData<FormFullDto>(
      form.uuid,
      new FormFullDto(form, {
        translated,
        ...this.translateFields(translations, form, ["title", "subtitle", "description", "submissionMessage"]),
        fundingProgrammeId: form.stage?.fundingProgrammeId ?? null,
        bannerUrl: bannerMedia == null ? null : this.mediaService.getUrl(bannerMedia),
        sections: sortBy(sections, "order").map(sectionToDto)
      })
    );

    return document;
  }

  async store(attributes: StoreFormAttributes) {
    return await this.createForm(attributes);
  }

  private _userLocale?: ValidLocale;
  private async getUserLocale() {
    if (this._userLocale == null) {
      const userId = RequestContext.currentContext.req.authenticatedUserId as number | undefined | null;
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
        id => id != null
      ),
      await this.getUserLocale()
    );
  }

  private translateFields<M extends Model, K extends (keyof Attributes<M>)[]>(
    translations: Translations,
    model: M,
    fields: K
  ) {
    return fields.reduce(
      (translated, field) => ({
        ...translated,
        [field]: translations[model[`${String(field)}Id`] ?? -1] ?? model[field]
      }),
      {} as Record<(typeof fields)[number], string>
    );
  }

  private async createForm(attributes: StoreFormAttributes) {
    const form: Form = new Form();
    // Note: this field is a char(32) in the DB which would normally be a UUID, but the current
    // rows are all numerical IDs.
    form.updatedBy = `${RequestContext.currentContext.req.authenticatedUserId}`;
    form.title = attributes.title;
    form.titleId = await this.localizationService.generateI18nId(attributes.title);
    form.subtitle = attributes.subtitle ?? null;
    form.subtitleId = await this.localizationService.generateI18nId(attributes.subtitle);
    form.frameworkKey = attributes.frameworkKey ?? null;
    form.type = attributes.type ?? null;
    form.description = attributes.description ?? null;
    form.descriptionId = await this.localizationService.generateI18nId(attributes.description);
    form.documentation = attributes.documentation ?? null;
    form.documentationLabel = attributes.documentationLabel ?? null;
    form.deadlineAt = attributes.deadlineAt ?? null;
    form.submissionMessage = attributes.submissionMessage;
    form.submissionMessageId = await this.localizationService.generateI18nId(attributes.submissionMessage);
    form.stageId = attributes.stageId ?? null;
    form.version = attributes.stageId == null ? 1 : (await Form.count({ where: { stageId: attributes.stageId } })) + 1;
    // Newly created forms are always unpublished
    form.published = false;
    await form.save();

    await Promise.all(
      (attributes.sections ?? []).map((section, index) => this.createSection(form.uuid, section, index))
    );

    return form;
  }

  private async createSection(formUuid: string, attributes: StoreFormSectionAttributes, order: number) {
    const section = new FormSection();
    section.formId = formUuid;
    section.order = order;
    section.title = attributes.title ?? null;
    section.titleId = await this.localizationService.generateI18nId(attributes.title);
    section.description = attributes.description ?? null;
    section.descriptionId = await this.localizationService.generateI18nId(attributes.description);
    await section.save();

    await Promise.all(
      (attributes.questions ?? []).map((question, index) => this.createQuestion(section.id, question, index))
    );

    return section;
  }

  private async createQuestion(
    sectionId: number,
    attributes: StormFormQuestionAttributes,
    order: number,
    parentUuid?: string
  ) {
    const question = new FormQuestion();
    question.formSectionId = sectionId;
    question.order = order;
    question.parentId = parentUuid ?? null;
    question.linkedFieldKey = attributes.linkedFieldKey ?? null;
    question.inputType = attributes.inputType;
    question.label = attributes.label;
    question.labelId = await this.localizationService.generateI18nId(attributes.label);
    question.name = attributes.name ?? null;
    question.placeholder = attributes.placeholder ?? null;
    question.placeholderId = await this.localizationService.generateI18nId(attributes.placeholder);
    question.description = attributes.description ?? null;
    question.descriptionId = await this.localizationService.generateI18nId(attributes.description);
    question.validation = attributes.validation ?? null;
    question.additionalProps = attributes.additionalProps ?? null;
    question.optionsOther = attributes.optionsOther ?? null;
    question.multiChoice = attributes.multiChoice ?? false;
    question.collection = attributes.collection ?? null;
    question.optionsList = attributes.optionsList ?? null;
    question.showOnParentCondition = attributes.showOnParentCondition ?? null;
    question.years = attributes.years ?? null;
    question.minCharacterLimit = attributes.minCharacterLimit ?? null;
    question.maxCharacterLimit = attributes.maxCharacterLimit ?? null;
    await question.save();

    if (question.inputType === "tableInput") {
      await Promise.all(
        (attributes.tableHeaders ?? []).map(async (label, index) => {
          const header = new FormTableHeader();
          header.formQuestionId = question.id;
          header.label = label;
          header.labelId = await this.localizationService.generateI18nId(label);
          header.order = index;
          await header.save();
        })
      );
    }

    await Promise.all(
      (attributes.options ?? []).map((option, index) => this.createFormQuestionOption(question.id, option, index))
    );

    await Promise.all(
      (attributes.children ?? []).map((child, index) => this.createQuestion(sectionId, child, index, question.uuid))
    );
  }

  private async createFormQuestionOption(
    questionId: number,
    attributes: StoreFormQuestionOptionAttributes,
    order: number
  ) {
    const option = new FormQuestionOption();
    option.formQuestionId = questionId;
    option.order = order;
    option.slug = attributes.slug;
    option.label = attributes.label;
    option.labelId = await this.localizationService.generateI18nId(attributes.label);
    option.imageUrl = attributes.imageUrl ?? null;
    await option.save();
  }
}
