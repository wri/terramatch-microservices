import { Injectable } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { MAX_CSV_EXPORT_ROWS } from "@terramatch-microservices/common/export/csv-export.constants";
import { EntitiesService } from "./entities.service";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { SrpReportProcessor } from "./processors/srp-report.processor";
import { FinancialReport, Form, FormSubmission } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Response } from "express";
import { DateTime } from "luxon";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";

const EXPORTABLE_ENTITY_TYPES = ["financialReports", "srpReports"] as const;
export type CsvExportableEntityType = (typeof EXPORTABLE_ENTITY_TYPES)[number];

const FINANCIAL_REPORT_CSV_COLUMNS: Record<string, string> = {
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

const SRP_REPORT_CSV_COLUMNS: Record<string, string> = {
  projectUuid: "Project UUID",
  projectName: "Project Name",
  status: "Status",
  totalUniqueRestorationPartners: "Total Unique Restoration Partners",
  year: "Year",
  createdAt: "Created At",
  updatedAt: "Updated At",
  submittedAt: "Submitted At"
};

const FORM_SUBMISSION_CSV_COLUMNS: Record<string, string> = {
  status: "Submission Statuses",
  stageName: "Current Stage",
  organisationType: "Organisation Type",
  organisationName: "Organisation Name",
  organisationPhone: "Organisation WhatsApp Enabled Phone Number",
  organisationStreet1: "Headquarters Street address",
  organisationStreet2: "Headquarters street address 2",
  organisationCity: "Headquarters address City",
  organisationState: "Headquarters address State/Province",
  organisationZipcode: "Headquarters address Zipcode",
  organisationProofOfLegalRegistration: "Proof of local legal registration, incorporation, or right to operate",
  organisationWebsite: "Website URL (optional)",
  organisationFacebook: "Organization Facebook URL(optional)",
  organisationInstagram: "Organization Instagram URL(optional)",
  organisationLinkedin: "Organization LinkedIn URL(optional)",
  organisationLogo: "Upload your organization logo(optional)",
  organisationCover: "Upload a cover photo (optional)",
  updatedByName: "User Name"
};

@Injectable()
export class EntityCsvExportService {
  private readonly logger = new TMLogger(EntityCsvExportService.name);

  constructor(private readonly entitiesService: EntitiesService, private readonly csvExportService: CsvExportService) {}

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
    const form = await Form.findOne({ where: { uuid: formUuid }, attributes: ["title"] });
    response.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${form?.title} Submission Export - ${DateTime.now().toFormat(
        "yyyy-MM-dd HH:mm:ss"
      )}.csv"`
    });

    const { addRow, close } = this.csvExportService.getResponseStreamWriter(response, FORM_SUBMISSION_CSV_COLUMNS);
    try {
      const builder = new PaginatedQueryBuilder(FormSubmission, 10, [
        { association: "application", attributes: ["uuid", "fundingProgrammeUuid"] },
        {
          association: "organisation",
          attributes: [
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
            "twitterUrl"
          ]
        },
        { association: "stage", attributes: ["name"] }
      ]).where({ formId: formUuid });

      for await (const page of batchFindAll(builder)) {
        for (const submission of page) {
          addRow(submission);
        }
      }
    } catch (error) {
      this.logger.error(`Error exporting form submissions CSV for form ${formUuid}: ${error}`);
    } finally {
      close();
    }
  }
}
