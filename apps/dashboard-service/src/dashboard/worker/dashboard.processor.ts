import { Processor, WorkerHost } from "@nestjs/bullmq";
import { TotalSectionHeaderService } from "../dto/total-section-header.service";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { CacheService } from "../dto/cache.service";
import { DelayedJob } from "@terramatch-microservices/database/entities";

@Processor("dashboard")
export class DashboardProcessor extends WorkerHost {
  private readonly logger = new TMLogger(DashboardProcessor.name);

  constructor(
    private readonly totalSectionHeaderService: TotalSectionHeaderService,
    private readonly cacheService: CacheService
  ) {
    super();
  }

  async process(job: Job) {
    const { name, data } = job;
    this.logger.log(`Processing job: ${name} with data: ${JSON.stringify(data)}`);
    const { cacheKey, delayedJobId, ...jobData } = data as DashboardQueryDto & {
      cacheKey: string;
      delayedJobId: string;
    };
    const result = await this.totalSectionHeaderService.getTotalSectionHeader(jobData as DashboardQueryDto);
    await DelayedJob.update({ status: "succeeded", statusCode: 200, payload: result }, { where: { id: delayedJobId } });
    await this.cacheService.set(cacheKey, JSON.stringify(result));
  }
}
