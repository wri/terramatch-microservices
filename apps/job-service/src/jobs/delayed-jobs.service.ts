import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DelayedJob, FailedJob } from "@terramatch-microservices/database/entities";
import { DateTime } from "luxon";
import { Op } from "sequelize";

@Injectable()
export class DelayedJobsService {
  private readonly logger = new TMLogger(DelayedJobsService.name);

  @Cron(CronExpression.EVERY_12_HOURS, { name: "cleanDelayedJobs" })
  async cleanDelayedJobs() {
    const deletedJobsCount = await DelayedJob.destroy({
      where: {
        status: {
          [Op.ne]: "pending"
        },
        updatedAt: {
          [Op.lt]: DateTime.now().minus({ days: 1 }).toJSDate()
        }
      }
    });
    this.logger.log(`Cleaned ${deletedJobsCount} delayed jobs`);
  }

  @Cron(CronExpression.EVERY_12_HOURS, { name: "cleanFailedJobs" })
  async cleanFailedJobs() {
    const deletedFailedJobsCount = await FailedJob.destroy({
      where: {
        failedAt: {
          [Op.lt]: DateTime.now().minus({ days: 1 }).toJSDate()
        }
      }
    });
    this.logger.log(`Cleaned ${deletedFailedJobsCount} failed jobs`);
  }
}
