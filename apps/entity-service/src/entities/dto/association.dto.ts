import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

export type AssociationDtoAdditionalProps = {
  entityType: EntityType;
  entityUuid: string;
};

export abstract class AssociationDto {
  @ApiProperty({ enum: ENTITY_TYPES, description: "The entity type this resource is associated with." })
  entityType: EntityType;

  @ApiProperty({ description: "The entity UUID this resource is associated with." })
  entityUuid: string;
}
