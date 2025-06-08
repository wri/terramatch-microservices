import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";
import { MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";

export type AssociationDtoAdditionalProps = {
  entityType: EntityType | MediaOwnerType;
  entityUuid: string;
};

export abstract class AssociationDto {
  @ApiProperty({ enum: ENTITY_TYPES, description: "The entity type this resource is associated with." })
  entityType: MediaOwnerType;

  @ApiProperty({ description: "The entity UUID this resource is associated with." })
  entityUuid: string;
}
