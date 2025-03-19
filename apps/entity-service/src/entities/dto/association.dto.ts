import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

export type AssociationDtoAdditionalProps = {
  entityType: EntityType;
  entityUuid: string;
};
import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

export abstract class AssociationDto<T> extends JsonApiAttributes<T> {
  @ApiProperty({ enum: ENTITY_TYPES, description: "The entity type this resource is associated with." })
  entityType: EntityType;

  @ApiProperty({ description: "The entity UUID this resource is associated with." })
  entityUuid: string;
}
