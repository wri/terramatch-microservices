import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ENTITIES, ProcessableEntity } from "../entities.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

// Adding sitePolygons to the list of entities
export const AUDITABLE_ENTITY_TYPES = [...PROCESSABLE_ENTITIES, "sitePolygons"] as const;
export type AuditableEntityType = ProcessableEntity | "sitePolygons";

export class AuditStatusParamsDto extends SingleResourceDto {
  @IsIn(AUDITABLE_ENTITY_TYPES)
  @ApiProperty({ enum: AUDITABLE_ENTITY_TYPES, description: "Entity type to retrieve audit statuses for" })
  entity: AuditableEntityType;
}
