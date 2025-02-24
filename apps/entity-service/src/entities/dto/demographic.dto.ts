import { AssociationDto } from "./association.dto";
import { Demographic } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

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
      entries: demographic.entries.map(entry => new DemographicEntryDto(entry))
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
