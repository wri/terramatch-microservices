import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Audit } from "@terramatch-microservices/database/entities";
import { col, where } from "sequelize";

@Injectable()
export class AuditsService {
  private readonly logger = new TMLogger(AuditsService.name);

  @Cron(CronExpression.EVERY_12_HOURS, { name: "cleanAudits" })
  async cleanAudits() {
    const deletedAuditCount = await Audit.destroy({
      where: where(col("old_values"), "=", col("new_values"))
    });
    this.logger.log(`Cleaned ${deletedAuditCount} audits`);
  }
}
