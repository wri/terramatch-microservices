import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { DASHBOARD_ENTITIES, DashboardEntity } from "../constants/dashboard-entities.constants";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";

export class DashboardEntityDto extends HybridSupportDto {
  @ApiProperty()
  uuid: string;
}

export class DashboardEntityParamsDto {
  @IsIn(DASHBOARD_ENTITIES)
  entity: DashboardEntity;
}

export class DashboardEntityWithUuidDto extends DashboardEntityParamsDto {
  @IsUUID()
  uuid: string;
}
