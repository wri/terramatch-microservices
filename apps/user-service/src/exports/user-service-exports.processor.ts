import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { Processor } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Job, Queue } from "bullmq";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { InternalServerErrorException } from "@nestjs/common";
import { DelayedJob, Media, Organisation } from "@terramatch-microservices/database/entities";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "@terramatch-microservices/common/dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { Dictionary, startCase } from "lodash";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

type UserServiceExportJobData = {
  delayedJobId: number;
  fileName: string;
};

export const USER_SERVICE_EXPORT_QUEUE = "userServiceExports";
export const ORGANISATIONS_EXPORT = "organisationsExport";

const ORGANISATION_CSV_COLUMNS: Dictionary<string> = {
  status: "Status",
  type: "Type",
  private: "Private",
  name: "Name",
  phone: "Phone",
  hqStreet1: "HQ Street 1",
  hqStreet2: "HQ Street 2",
  hqCity: "HQ City",
  hqState: "HQ State",
  hqZipcode: "HQ Zipcode",
  hqCountry: "HQ Country",
  countries: "Countries",
  languages: "Languages",
  foundingDate: "Founding Date",
  description: "Description",
  treeSpeciesGrown: "Tree Species Grown",
  webUrl: "Web URL",
  facebookUrl: "Facebook URL",
  instagramUrl: "Instagram URL",
  linkedinUrl: "Linkedin URL",
  twitterUrl: "Twitter URL",
  finStartMonth: "Fin Start Month",
  finBudget3year: "Fin Budget 3year",
  finBudget2year: "Fin Budget 2year",
  finBudget1year: "Fin Budget 1year",
  finBudgetCurrentYear: "Fin Budget Current Year",
  haRestoredTotal: "Ha Restored Total",
  haRestored3year: "Ha Restored 3year",
  treesGrownTotal: "Trees Grown Total",
  treesGrown3year: "Trees Grown 3year",
  treeCareApproach: "Tree Care Approach",
  relevantExperienceYears: "Relevant Experience Years",
  lastUpdatedAt: "Last Updated At",
  createdAt: "Created At",
  ...Object.keys(Organisation.MEDIA).reduce((acc, key) => ({ ...acc, [key]: startCase(key) }), {})
};

const KEEP_JOBS_TIMEOUT = 60 * 60; // keep jobs for 1 hour after completion (instead of default of forever)
@Processor(USER_SERVICE_EXPORT_QUEUE, {
  concurrency: 100,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class UserServiceExportsProcessor extends DelayedJobWorker<UserServiceExportJobData> {
  protected readonly logger = new TMLogger(UserServiceExportsProcessor.name);

  static async queueOrganisationExport(queue: Queue, fileName: string) {
    const delayedJob = await DelayedJob.create({
      name: "Organisation CSV Export",
      createdBy: authenticatedUserId()
    });
    const data: UserServiceExportJobData = { delayedJobId: delayedJob.id, fileName: fileName };
    await queue.add(ORGANISATIONS_EXPORT, data);
    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  constructor(private readonly csvExportService: CsvExportService, private readonly mediaService: MediaService) {
    super();
  }

  async processDelayedJob(job: Job<UserServiceExportJobData>) {
    if (job.name !== ORGANISATIONS_EXPORT) {
      throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);
    }

    const { fileName } = job.data;
    const { addRow, close } = this.csvExportService.getS3StreamWriter(fileName, ORGANISATION_CSV_COLUMNS);
    try {
      const builder = new PaginatedQueryBuilder(Organisation, 10).where({ isTest: false });
      for await (const page of batchFindAll(builder)) {
        const pageMedia = await Media.for(page).findAll();
        for (const org of page) {
          const additional = pageMedia
            .filter(media => media.modelId === org.id)
            .reduce(
              (acc, media) => ({
                ...acc,
                [media.collectionName]: this.mediaService.getUrl(media)
              }),
              {}
            );
          addRow(org, additional);
        }
      }
    } catch (error) {
      throw new DelayedJobException(500, `Failed to export organisations to CSV: ${error.message}`);
    } finally {
      close();
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        "organisationsExport",
        await this.csvExportService.generateExportDto(fileName)
      )
    };
  }
}
