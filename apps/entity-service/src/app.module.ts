import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [],
  providers: []
})
export class AppModule {}
