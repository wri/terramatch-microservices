import { IsIn, IsUUID } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { DASHBOARD_ENTITIES, DashboardEntity } from "@terramatch-microservices/database/constants";

@JsonApiDto({ type: "dashboardEntity" })
export class DashboardEntityDto {
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
