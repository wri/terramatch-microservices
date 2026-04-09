import { Injectable } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { MAX_CSV_EXPORT_ROWS } from "@terramatch-microservices/common/export/csv-export.constants";
import { EntitiesService } from "./entities.service";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { FormDataService } from "./form-data.service";
import { SubmissionExportQueryDto } from "./dto/submission-export-query.dto";
import { SrpReportProcessor } from "./processors/srp-report.processor";
import { FinancialReport } from "@terramatch-microservices/database/entities";

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
  organisationCover: "Upload a cover photo (optional)"
};

@Injectable()
export class EntityCsvExportService {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly csvExportService: CsvExportService,
    private readonly formDataService: FormDataService
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

  async exportFormSubmissionsCsv(query: SubmissionExportQueryDto): Promise<string> {
    const { submissions } = await this.formDataService.findSubmissionsForExport(query);
    if (submissions.length > 0) {
      await this.entitiesService.authorize("read", submissions);
    }
    const rows = submissions.map(s => ({
      status: s.status,
      name: s.name,
      stageName: s.stageName,
      organisationType: s.organisationType,
      organisationName: s.organisationName,
      organisationPhone: s.organisationPhone,
      organisationStreet1: s.organisationStreet1,
      organisationStreet2: s.organisationStreet2,
      organisationCity: s.organisationCity,
      organisationState: s.organisationState,
      organisationZipcode: s.organisationZipcode,
      organisationWebUrl: s.organisationWebUrl,
      organisationFacebookUrl: s.organisationFacebookUrl,
      organisationInstagramUrl: s.organisationInstagramUrl,
      organisationLinkedinUrl: s.organisationLinkedinUrl,
      organisationTwitterUrl: s.organisationTwitterUrl,
      organisationUuid: s.organisationUuid,
      projectPitchUuid: s.projectPitchUuid,
      projectName: s.projectPitch?.projectName ?? "",
      applicationUuid: s.application?.uuid ?? "",
      fundingProgrammeUuid: s.application?.fundingProgrammeUuid ?? "",
      userName: s.user == null ? "" : [s.user.firstName, s.user.lastName].filter(Boolean).join(" ").trim(),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
    return this.csvExportService.stringify(rows, FORM_SUBMISSION_CSV_COLUMNS);
  }
}
