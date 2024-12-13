import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { TreesController } from "./trees/trees.controller";
import { TreeService } from "./trees/tree.service";

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [TreesController],
  providers: [TreeService]
})
export class AppModule {}
