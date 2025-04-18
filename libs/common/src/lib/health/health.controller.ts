import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, SequelizeHealthIndicator } from "@nestjs/terminus";
import { ApiExcludeController } from "@nestjs/swagger";
import { User } from "@terramatch-microservices/database/entities";
import { QueueHealthIndicator } from "./queue-health.indicator";
import { NoBearerAuth } from "../guards";

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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sequelize = User.sequelize!;
    const connection = await sequelize.connectionManager.getConnection({ type: "read" });
    try {
      return this.health.check([() => this.db.pingCheck("database", { connection }), () => this.queue.isHealthy()]);
    } finally {
      sequelize.connectionManager.releaseConnection(connection);
    }
  }
}
