import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, SequelizeHealthIndicator } from "@nestjs/terminus";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ApiExcludeController } from "@nestjs/swagger";
import { User } from "@terramatch-microservices/database/entities";
import { QueueHealthIndicator } from "../airtable/queue-health.indicator";

@Controller("health")
@ApiExcludeController()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: SequelizeHealthIndicator,
    private readonly queue: QueueHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  @NoBearerAuth
  async check() {
    const connection = await User.sequelize.connectionManager.getConnection({ type: "read" });
    try {
      return this.health.check([() => this.db.pingCheck("database", { connection }), () => this.queue.isHealthy()]);
    } finally {
      User.sequelize.connectionManager.releaseConnection(connection);
    }
  }
}
