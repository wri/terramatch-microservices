import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ASSOCIATIONS, ProcessableAssociation } from "../entities.service";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

export class EntityAssociationIndexParamsDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({ enum: ENTITY_TYPES, description: "Entity type for associations" })
  entity: EntityType;

  @IsIn(PROCESSABLE_ASSOCIATIONS)
  @ApiProperty({ enum: PROCESSABLE_ASSOCIATIONS, description: "Association type to retrieve" })
  association: ProcessableAssociation;
}
