import { Injectable } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { MAX_CSV_EXPORT_ROWS } from "@terramatch-microservices/common/export/csv-export.constants";
import { EntitiesService } from "./entities.service";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { SrpReportProcessor } from "./processors/srp-report.processor";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Dictionary } from "lodash";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

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

@Injectable()
export class EntityCsvExportService {
  private readonly logger = new TMLogger(EntityCsvExportService.name);

  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly mediaService: MediaService,
    private readonly csvExportService: CsvExportService
  ) {}

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
}
