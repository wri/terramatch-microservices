import { BadRequestException, Injectable } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { MAX_CSV_EXPORT_ROWS } from "@terramatch-microservices/common/export/csv-export.constants";
import { EntitiesService } from "./entities.service";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { SrpReportProcessor } from "./processors/srp-report.processor";
import {
  FinancialReport,
  Form,
  FormQuestion,
  FormSection,
  FormSubmission,
  Media
} from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Response } from "express";
import { DateTime } from "luxon";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { Dictionary, groupBy, isObject, uniq, uniqBy } from "lodash";
import {
  getExportHeading,
  getLinkedFieldConfig,
  getModelAttribute,
  LinkedFieldSpecification,
  ModelAttribute
} from "@terramatch-microservices/common/linkedFields";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { Includeable } from "sequelize";
import { FormModels, LinkedAnswerCollector } from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { isField, isFile } from "@terramatch-microservices/database/constants/linked-fields";
import { FrameworkKey } from "@terramatch-microservices/database/constants";

const EXPORTABLE_ENTITY_TYPES = ["financialReports", "srpReports"] as const;
export type CsvExportableEntityType = (typeof EXPORTABLE_ENTITY_TYPES)[number];

type FormQuestionExportMapping = {
  questionUuid: string;
  heading: string;
  attribute?: ModelAttribute;
  config?: LinkedFieldSpecification;
};

const FINANCIAL_REPORT_CSV_COLUMNS: Dictionary<string> = {
  id: "ID",
  uuid: "UUID",
  organisationId: "Organisation ID",
  organisationName: "Organisation Name",
  status: "Status",
  yearOfReport: "Year of Report",
  currency: "Currency",
  financialStartMonth: "Financial Start Month",
  submittedAt: "Submitted At",
  createdAt: "Created At",
  updatedAt: "Updated At",
  financialIndicators: "Financial Indicators"
};

const SRP_REPORT_CSV_COLUMNS: Dictionary<string> = {
  projectUuid: "Project UUID",
  projectName: "Project Name",
  status: "Status",
  totalUniqueRestorationPartners: "Total Unique Restoration Partners",
  year: "Year",
  createdAt: "Created At",
  updatedAt: "Updated At",
  submittedAt: "Submitted At"
};

const FORM_SUBMISSION_CSV_COLUMNS: Dictionary<string> = {
  applicationUuid: "Application ID",
  organisationUuid: "Organisation ID",
  projectPitchUuid: "Project Pitch ID",
  status: "Submission Status",
  stageName: "Current Stage",
  organisationType: "Organisation Type",
  organisationName: "Organization Legal Name",
  organisationPhone: "Organization WhatsApp Enabled Phone Number",
  organisationStreet1: "Headquarters Street address",
  organisationStreet2: "Headquarters street address 2",
  organisationCity: "Headquarters address City",
  organisationState: "Headquarters address State/Province",
  organisationZipcode: "Headquarters address Zipcode",
  organisationLegalRegistration: "Proof of local legal registration, incorporation, or right to operate",
  organisationWebUrl: "Website URL (optional)",
  organisationFacebookUrl: "Organization Facebook URL(optional)",
  organisationInstagramUrl: "Organization Instagram URL(optional)",
  organisationLinkedinUrl: "Organization LinkedIn URL(optional)",
  organisationLogo: "Upload your organization logo(optional)",
  organisationCover: "Upload a cover photo (optional)",
  createdAt: "Created At",
  updatedAt: "Updated At"
};

const mapAttributes = (mappings: FormQuestionExportMapping[], model: FormModelType) =>
  mappings
    .filter(({ attribute }) => attribute?.model === model)
    .map(({ attribute }) => attribute?.attribute)
    .filter(isNotNull);

@Injectable()
export class EntityCsvExportService {
  private readonly logger = new TMLogger(EntityCsvExportService.name);

  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly mediaService: MediaService,
    private readonly csvExportService: CsvExportService
  ) {}

  isExportableEntityType(entity: string): entity is CsvExportableEntityType {
    return (EXPORTABLE_ENTITY_TYPES as readonly string[]).includes(entity);
  }

  async exportFinancialReportsCsv(): Promise<string> {
    const models = await FinancialReport.findAll({
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type"]
        }
      ]
    });

    const rows = models.map(model => ({
      uuid: model.uuid,
      status: model.status,
      organisationId: model.organisationId,
      organisationName: model.organisationName,
      yearOfReport: model.yearOfReport,
      currency: model.currency,
      financialStartMonth: model.finStartMonth,
      submittedAt: model.submittedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      financialIndicators: model.financialIndicators
    }));
    return this.csvExportService.stringify(rows, FINANCIAL_REPORT_CSV_COLUMNS);
  }

  async exportSrpReportsCsv(query: EntityQueryDto): Promise<string> {
    const processor = this.entitiesService.createEntityProcessor("srpReports") as SrpReportProcessor;
    const { models } = await processor.findManyForExport(query, MAX_CSV_EXPORT_ROWS);
    if (models.length > 0) {
      await this.entitiesService.authorize("read", models);
    }
    const dtoResults = await processor.getLightDtos(models);
    const rows = dtoResults.map(({ dto }) => ({
      uuid: dto.uuid,
      status: dto.status,
      updateRequestStatus: dto.updateRequestStatus,
      completion: dto.completion,
      projectName: dto.projectName,
      projectUuid: dto.projectUuid,
      organisationName: dto.organisationName,
      organisationUuid: dto.organisationUuid,
      taskUuid: dto.taskUuid,
      projectStatus: dto.projectStatus,
      year: dto.year,
      dueAt: dto.dueAt,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      submittedAt: dto.submittedAt
    }));
    return this.csvExportService.stringify(rows, SRP_REPORT_CSV_COLUMNS);
  }

  async exportFormSubmissionsCsv(formUuid: string, response: Response) {
    const form = await Form.findOne({ where: { uuid: formUuid }, attributes: ["uuid", "title"] });
    if (form == null) throw new BadRequestException(`Form with UUID ${formUuid} not found`);

    const mappings = await this.getFormQuestionsForExport(form);

    const filename = `${form?.title} Submission Export - ${DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss")}.csv`;
    const { addRow, close } = this.csvExportService.getResponseStreamWriter(filename, response, {
      ...FORM_SUBMISSION_CSV_COLUMNS,
      ...mappings.reduce((acc, { heading }) => ({ ...acc, [heading]: heading }), {} as Dictionary<string>)
    });
    try {
      const orgAttributes = uniq([
        "id",
        "uuid",
        "name",
        "type",
        "phone",
        "hqStreet1",
        "hqStreet2",
        "hqCity",
        "hqState",
        "hqZipcode",
        "webUrl",
        "facebookUrl",
        "instagramUrl",
        "linkedinUrl",
        "twitterUrl",
        ...mapAttributes(mappings, "organisations")
      ]);
      const pitchAttributes = uniq(["id", "uuid", ...mapAttributes(mappings, "projectPitches")]);
      const includes: Includeable[] = [
        { association: "application", attributes: ["uuid", "fundingProgrammeUuid"] },
        { association: "organisation", attributes: orgAttributes },
        { association: "projectPitch", attributes: pitchAttributes },
        { association: "stage", attributes: ["name"] }
      ];
      const builder = new PaginatedQueryBuilder(FormSubmission, 10, includes).where({ formId: formUuid });

      for await (const page of batchFindAll(builder)) {
        const orgs = uniqBy(page.map(submission => submission.organisation).filter(isNotNull), "id");
        const orgsMedia = await Media.for(orgs).collection(["logo", "cover", "legalRegistration"]).findAll();
        for (const submission of page) {
          if (submission.organisation == null || submission.projectPitch == null) continue;
          const media = orgsMedia.filter(({ modelId }) => modelId === submission.organisation?.id);
          const additional = {
            organisationLegalRegistration: this.mediaCell(
              media.filter(({ collectionName }) => collectionName === "legal_registration")
            ),
            organisationLogo: this.mediaCell(media.filter(({ collectionName }) => collectionName === "logo")),
            organisationCover: this.mediaCell(media.filter(({ collectionName }) => collectionName === "cover")),
            ...(await this.collectFormCells(
              mappings,
              {
                organisations: submission.organisation ?? undefined,
                projectPitches: submission.projectPitch ?? undefined
              },
              form.frameworkKey ?? undefined
            ))
          };
          addRow(submission, additional);
        }
      }
    } catch (error) {
      this.logger.error(`Error exporting form submissions CSV for form ${formUuid}: ${error}`, error.stack);
    } finally {
      close();
    }
  }

  private async getFormQuestionsForExport(form: Form) {
    const sections = await FormSection.findAll({ where: { formId: form.uuid }, order: [["order", "ASC"]] });
    const questions = await FormQuestion.forForm(form.uuid).findAll({ order: [["order", "ASC"]] });
    const sectionQuestions = groupBy(
      questions.filter(({ parentId }) => parentId == null),
      "formSectionId"
    );
    const childQuestions = groupBy(
      questions.filter(({ parentId }) => parentId != null),
      "parentId"
    );

    const mappings: FormQuestionExportMapping[] = [];

    for (const section of sections) {
      for (const question of sectionQuestions[`${section.id}`] ?? []) {
        this.addQuestionToMapping(mappings, question);

        for (const child of childQuestions[`${question.id}`] ?? []) {
          this.addQuestionToMapping(mappings, child);
        }
      }
    }

    return mappings;
  }

  private addQuestionToMapping(mappings: FormQuestionExportMapping[], question: FormQuestion) {
    if (question.linkedFieldKey == null || question.inputType === "tableInput") return;

    const config = getLinkedFieldConfig(question.linkedFieldKey);
    mappings.push({
      questionUuid: question.uuid,
      heading: getExportHeading(config),
      attribute: getModelAttribute(config),
      config
    });
  }

  private mediaCell(media: Media[]) {
    return media.map(this.entitiesService.fullUrl).filter(isNotNull).join("|");
  }

  private async collectFormCells(
    mappings: FormQuestionExportMapping[],
    models: FormModels,
    frameworkKey?: FrameworkKey
  ) {
    const collector = new LinkedAnswerCollector(this.mediaService);
    for (const mapping of mappings) {
      if (mapping.config == null) continue;

      const { model, field } = mapping.config;
      if (isField(field)) collector.fields.addField(field, model, mapping.questionUuid);
      else if (isFile(field)) collector.files.addField(field, model, mapping.questionUuid);
      else collector[field.resource].addField(field, model, mapping.questionUuid);
    }

    const answers: Dictionary<unknown> = {};
    await collector.collect(answers, models, { forExport: true, frameworkKey });

    // Some collectors need the original question UUID to correctly map their readable export data,
    // so we have to pass the question UUID into the collector and then re-map to our headings after
    // data collection.
    return Object.entries(answers).reduce((acc, [questionUuid, value]) => {
      const { heading } = mappings.find(mapping => questionUuid === mapping.questionUuid) ?? {};
      if (heading == null) return acc;

      return {
        ...acc,
        [heading]: Array.isArray(value) ? value.join("|") : isObject(value) ? JSON.stringify(value) : value
      };
    }, {});
  }
}
