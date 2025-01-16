import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, SequelizeHealthIndicator } from "@nestjs/terminus";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ApiExcludeController } from "@nestjs/swagger";
import { User } from "@terramatch-microservices/database/entities";
import { QueueHealthService } from "../airtable/queue-health.service";

@Controller("health")
@ApiExcludeController()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: SequelizeHealthIndicator,
    private readonly queue: QueueHealthService
  ) {}

  @Get()
  @HealthCheck()
  @NoBearerAuth
  async check() {
    const connection = await User.sequelize.connectionManager.getConnection({ type: "read" });
    try {
      return this.health.check([
        () => this.db.pingCheck("database", { connection }),
        () => this.queue.queueHealthCheck()
      ]);
    } finally {
      User.sequelize.connectionManager.releaseConnection(connection);
    }
  }
}
