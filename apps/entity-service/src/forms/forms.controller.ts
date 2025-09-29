import { Controller, Get, NotFoundException, Param, Request } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FormDto, FormLightDto } from "./dto/form.dto";
import { FormQuestionDto, FormQuestionOptionDto, FormTableHeaderDto } from "./dto/form-question.dto";
import { FormSectionDto } from "./dto/form-section.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import {
  Form,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  Media,
  User
} from "@terramatch-microservices/database/entities";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { filter, flattenDeep, groupBy, uniq } from "lodash";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { MediaDto } from "../entities/dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

// TODO (NJC): Specs for this controller before epic TM-2411 is merged
@Controller("forms/v3/forms")
export class FormsController {
  constructor(private readonly localizationService: LocalizationService, private readonly mediaService: MediaService) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "formGet",
    description: "Get a form by uuid. Includes all sections and questions within the form."
  })
  @ApiParam({ name: "uuid", type: String, description: "Form uuid" })
  @JsonApiResponse({ data: FormLightDto, included: [FormSectionDto, FormQuestionDto] })
  @ExceptionResponse(NotFoundException, { description: "Form not found" })
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async formGet(@Param("uuid") uuid: string, @Request() { authenticatedUserId }) {
    const locale = await User.findLocale(authenticatedUserId);
    if (locale == null) throw new BadRequestException("Locale is required");

    // Note: a lot of this method will likely be abstracted to a service when the form index endpoint is implemented.
    const form = await Form.findOne({
      where: { uuid },
      include: [{ association: "stage", attributes: ["fundingProgrammeId"] }]
    });
    if (form == null) throw new NotFoundException("Form not found");

    // Note: Fetching the sections / questions / table headers as their own queries is substantially
    // more efficient than joining these large tables together into the form query above.
    // Note: Form / section / question relations are odd - form_sections.form_id is the form uuid, but
    // form questions and form table headers relate to their parents via numerical ID.
    const sections = await FormSection.findAll({ where: { formId: form.uuid } });
    const questions = await FormQuestion.findAll({ where: { formSectionId: sections.map(({ id }) => id) } });
    const tableHeaders = await FormTableHeader.findAll({ where: { formQuestionId: questions.map(({ id }) => id) } });
    const options = await FormQuestionOption.findAll({ where: { formQuestionId: questions.map(({ id }) => id) } });

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
    const translations = await this.localizationService.translateIds(
      filter(
        uniq(flattenDeep([formI18nIds, sectionI18nIds, questionI18nIds, tableHeaderI18nIds, optionI18nIds])),
        id => id != null
      ),
      locale
    );

    const media = await Media.for(form).findAll();
    const bannerMedia = media.find(({ collectionName }) => collectionName === "banner");
    const documentMedia = media.find(({ collectionName }) => collectionName !== "banner");

    const document = buildJsonApi<FormDto>(FormDto);
    document.addData<FormDto>(
      form.uuid,
      new FormDto(form, {
        title: translations[form.titleId ?? -1] ?? form.title,
        subtitle: translations[form.subtitleId ?? -1] ?? form.subtitle,
        description: translations[form.descriptionId ?? -1] ?? form.description,
        submissionMessage: translations[form.submissionMessageId ?? -1] ?? form.submissionMessage,
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
        document:
          documentMedia == null
            ? null
            : new MediaDto(documentMedia, {
                url: this.mediaService.getUrl(documentMedia),
                thumbUrl: null,
                entityType: "forms",
                entityUuid: form.uuid
              })
      })
    );

    for (const section of sections) {
      document.addData<FormSectionDto>(
        section.uuid,
        new FormSectionDto(section, {
          title: translations[section.titleId ?? -1] ?? section.title,
          description: translations[section.descriptionId ?? -1] ?? section.description
        })
      );
    }

    const sectionsById = groupBy(sections, "id");
    const tableHeadersByQuestionId = groupBy(tableHeaders, "formQuestionId");
    const optionsByQuestionId = groupBy(options, "formQuestionId");
    for (const question of questions) {
      const config = getLinkedFieldConfig(question.linkedFieldKey ?? "");
      // For file questions, the collection is the property of the field.
      const collection = (question.inputType === "file" ? config?.field.property : question.collection) ?? null;
      document.addData<FormQuestionDto>(
        question.uuid,
        new FormQuestionDto(question, {
          model: config?.model ?? null,
          collection,
          label: translations[question.labelId ?? -1] ?? question.label,
          description: translations[question.descriptionId ?? -1] ?? question.description,
          placeholder: translations[question.placeholderId ?? -1] ?? question.placeholder,
          sectionId: sectionsById[question.formSectionId]?.[0]?.uuid,
          tableHeaders: tableHeadersByQuestionId[question.id]?.map(header =>
            populateDto<FormTableHeaderDto>(new FormTableHeaderDto(), {
              slug: header.slug,
              label: translations[header.labelId ?? -1] ?? header.label,
              order: header.order
            })
          ),
          options: optionsByQuestionId[question.id]?.map(option =>
            populateDto<FormQuestionOptionDto>(new FormQuestionOptionDto(), {
              slug: option.slug ?? "",
              imageUrl: option.imageUrl,
              label: translations[option.labelId ?? -1] ?? option.label,
              altValue: null,
              order: option.order
            })
          )
        })
      );
    }

    return document;
  }

  @Get()
  @ApiOperation({
    operationId: "formIndex",
    description: "Get a paginated and filtered list of forms. Includes all sections and questions within the form."
  })
  @JsonApiResponse({ data: FormDto, included: [FormSectionDto, FormQuestionDto], pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async formIndex(@Request() { authenticatedUserId }) {
    const locale = await User.findLocale(authenticatedUserId);
    if (locale == null) throw new BadRequestException("Locale is required");
  }
}
