import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ENTITIES, ProcessableEntity } from "../entities.service";

export class EntityIndexParamsDto {
  @IsIn(PROCESSABLE_ENTITIES)
  @ApiProperty({ enum: PROCESSABLE_ENTITIES, description: "Entity type to retrieve" })
  entity: ProcessableEntity;
}

const REPORTS_META_ENTITIES = ["projects"] as const;
type ReportsMetaEntity = (typeof REPORTS_META_ENTITIES)[number];

export class ReportsMetaParamsDto {
  @IsIn(REPORTS_META_ENTITIES)
  @ApiProperty({ enum: REPORTS_META_ENTITIES, description: "Entity type to retrieve report meta for" })
  entity: ReportsMetaEntity;
}

const NURSERIES_META_ENTITIES = ["projects"] as const;
type NurseriesMetaEntity = (typeof NURSERIES_META_ENTITIES)[number];

export class NurseriesMetaParamsDto {
  @IsIn(NURSERIES_META_ENTITIES)
  @ApiProperty({ enum: NURSERIES_META_ENTITIES, description: "Entity type to retrieve nurseries meta for" })
  entity: NurseriesMetaEntity;
}

const SITES_META_ENTITIES = ["projects"] as const;
type SitesMetaEntity = (typeof SITES_META_ENTITIES)[number];

export class SitesMetaParamsDto {
  @IsIn(SITES_META_ENTITIES)
  @ApiProperty({ enum: SITES_META_ENTITIES, description: "Entity type to retrieve sites meta for" })
  entity: SitesMetaEntity;
}
