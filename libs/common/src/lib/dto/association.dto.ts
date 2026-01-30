import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";
import { MEDIA_OWNER_TYPES, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import {
  DEMOGRAPHIC_ASSOCIATION_TYPES,
  DemographicAssociationType
} from "@terramatch-microservices/database/types/tracking";
import { uniq } from "lodash";

const ASSOCIATION_TYPES = uniq([...ENTITY_TYPES, ...MEDIA_OWNER_TYPES, DEMOGRAPHIC_ASSOCIATION_TYPES]);
type AssociationEntityType = EntityType | MediaOwnerType | DemographicAssociationType;

export type AssociationDtoAdditionalProps = {
  entityType: AssociationEntityType;
  entityUuid: string;
};

export abstract class AssociationDto {
  @ApiProperty({ enum: ASSOCIATION_TYPES, description: "The entity type this resource is associated with." })
  entityType: AssociationEntityType;

  @ApiProperty({ description: "The entity UUID this resource is associated with." })
  entityUuid: string;
}
