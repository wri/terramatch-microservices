import { AssociationDto } from "./association.dto";
import { Demographic } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import {
  CONVERGENCE,
  DIRECT,
  DIRECT_OTHER,
  JOBS_PROJECT_COLLECTIONS,
  PAID_OTHER,
  RESTORATION_PARTNERS_PROJECT_COLLECTIONS,
  VOLUNTEERS_PROJECT_COLLECTIONS,
  WORKDAYS_PROJECT_COLLECTIONS,
  WORKDAYS_SITE_COLLECTIONS
} from "@terramatch-microservices/database/constants/demographic-collections";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { pull } from "lodash";

@JsonApiConstants
export class DemographicCollections {
  @ApiProperty({ enum: pull(Object.keys(WORKDAYS_PROJECT_COLLECTIONS), DIRECT, CONVERGENCE) })
  WORKDAYS_PROJECT_PPC: string[];

  @ApiProperty({ example: PAID_OTHER })
  WORKDAYS_PROJECT_OTHER: string;

  @ApiProperty({ enum: Object.keys(WORKDAYS_SITE_COLLECTIONS) })
  WORKDAYS_SITE: string[];

  @ApiProperty({ example: PAID_OTHER })
  WORKDAYS_SITE_OTHER: string;

  @ApiProperty({ enum: Object.keys(RESTORATION_PARTNERS_PROJECT_COLLECTIONS) })
  RESTORATION_PARTNERS_PROJECT: string[];

  @ApiProperty({ example: DIRECT_OTHER })
  RESTORATION_PARTNERS_PROJECT_OTHER: string;

  @ApiProperty({ enum: Object.keys(JOBS_PROJECT_COLLECTIONS) })
  JOBS_PROJECT: string[];

  @ApiProperty({ enum: Object.keys(VOLUNTEERS_PROJECT_COLLECTIONS) })
  VOLUNTEERS_PROJECT: string[];
}

export class DemographicEntryDto extends JsonApiAttributes<DemographicEntryDto> {
  @ApiProperty()
  type: string;

  @ApiProperty()
  subtype: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty()
  amount: number;
}

type DemographicDtoAdditionalProps = {
  entityType: EntityType;
  entityUuid: string;
  collectionTitle: string;
};

@JsonApiDto({ type: "demographics" })
export class DemographicDto extends AssociationDto<DemographicDto> {
  constructor(demographic: Demographic, additional: DemographicDtoAdditionalProps) {
    super({
      ...pickApiProperties(demographic as Omit<Demographic, "entities">, DemographicDto),
      ...additional,
      entries: demographic.entries?.map(entry => new DemographicEntryDto(entry)) ?? []
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: Demographic.VALID_TYPES })
  type: string;

  @ApiProperty()
  collection: string;

  @ApiProperty({ description: "The English human-readable title for this collection" })
  collectionTitle: string;

  @ApiProperty({ type: () => DemographicEntryDto, isArray: true })
  entries: DemographicEntryDto[];
}
