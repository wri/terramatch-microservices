import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { NoBearerAuth } from '@terramatch-microservices/common/guards';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @NoBearerAuth
  check() {
    // TODO: Check over things this service depends on, starting with the database
    //  https://docs.nestjs.com/recipes/terminus
    return this.health.check([]);
  }
}
