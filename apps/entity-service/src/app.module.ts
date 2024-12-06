import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { TreesController } from "./trees/trees.controller";
import { ResearchService } from "./trees/research.service";

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [TreesController],
  providers: [ResearchService]
})
export class AppModule {}
