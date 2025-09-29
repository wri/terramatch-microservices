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
import { filter, flattenDeep, groupBy, uniq } from "lodash";
import { FormFullDto, FormLightDto } from "./dto/form.dto";
import { FormSectionDto } from "./dto/form-section.dto";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { FormQuestionDto, FormQuestionOptionDto, FormTableHeaderDto } from "./dto/form-question.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Attributes, Model } from "sequelize";
import { FormQueryDto } from "./dto/form-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

const SORTABLE_FIELDS: (keyof Attributes<Form>)[] = ["title", "type"];
const SIMPLE_FILTERS: (keyof FormQueryDto)[] = ["type"];

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

  async findMany(query: FormQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Form, query.page);

    if (query.sort?.field != null) {
      if (SORTABLE_FIELDS.includes(query.sort?.field as keyof Attributes<Form>)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort?.field}`);
      }
    }

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) builder.where({ [term]: query[term] });
    }

    return { forms: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addIndex(document: DocumentBuilder, query: FormQueryDto) {
    const { forms, paginationTotal } = await this.findMany(query);
    const i18nIds = uniq(forms.map(({ titleId }) => titleId)).filter(id => id != null);
    const translations = await this.localizationService.translateIds(i18nIds, await this.getUserLocale());
    const bannerMediaByFormId = groupBy(
      await Media.for(forms).findAll({ where: { collectionName: "banner" } }),
      "modelId"
    );

    for (const form of forms) {
      const banner = bannerMediaByFormId[form.id]?.[0];
      document.addData(
        form.uuid,
        new FormLightDto(form, {
          ...this.translateFields(translations, form, ["title"]),
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

  async addFullDto(document: DocumentBuilder, form: Form): Promise<DocumentBuilder> {
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

    const translations = await this.getTranslationsForFullDto(form, sections, questions, tableHeaders, options);

    const bannerMedia = await Media.for(form).findOne({ where: { collectionName: "banner" } });
    document.addData<FormFullDto>(
      form.uuid,
      new FormFullDto(form, {
        ...this.translateFields(translations, form, ["title", "subtitle", "description", "submissionMessage"]),
        fundingProgrammeId: form.stage?.fundingProgrammeId ?? null,
        bannerUrl: bannerMedia == null ? null : this.mediaService.getUrl(bannerMedia)
      })
    );

    for (const section of sections) {
      document.addData<FormSectionDto>(
        section.uuid,
        new FormSectionDto(section, this.translateFields(translations, section, ["title", "description"]))
      );
    }

    const sectionsById = groupBy(sections, "id");
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

    for (const question of questions) {
      const config = getLinkedFieldConfig(question.linkedFieldKey ?? "");
      // For file questions, the collection is the property of the field.
      const collection = (question.inputType === "file" ? config?.field.property : question.collection) ?? null;
      document.addData<FormQuestionDto>(
        question.uuid,
        new FormQuestionDto(question, {
          model: config?.model ?? null,
          collection,
          ...this.translateFields(translations, question, ["label", "description", "placeholder"]),
          sectionId: sectionsById[question.formSectionId]?.[0]?.uuid,
          tableHeaders: tableHeadersByQuestionId[question.id]?.map(header =>
            populateDto<FormTableHeaderDto>(new FormTableHeaderDto(), {
              slug: header.slug,
              ...this.translateFields(translations, header, ["label"]),
              order: header.order
            })
          ),
          options: optionsByQuestionId[question.id]?.map(option =>
            populateDto<FormQuestionOptionDto>(new FormQuestionOptionDto(), {
              slug: option.slug ?? "",
              imageUrl: optionMediaByOptionId[option.id]?.url ?? option.imageUrl,
              thumbUrl: optionMediaByOptionId[option.id]?.thumbUrl ?? null,
              ...this.translateFields(translations, option, ["label"]),
              altValue: null,
              order: option.order
            })
          )
        })
      );
    }

    return document;
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
}
