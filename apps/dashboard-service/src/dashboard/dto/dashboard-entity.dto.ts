import { IsIn, IsUUID } from "class-validator";
import { DASHBOARD_ENTITIES } from "../dashboard-entities.service";
import { DashboardEntity } from "../dashboard-entities.service";

export class DashboardEntityParamsDto {
  @IsIn(DASHBOARD_ENTITIES)
  entity: DashboardEntity;
}
export class DashboardEntityDto extends DashboardEntityParamsDto {
  @IsUUID()
  uuid: string;
}
