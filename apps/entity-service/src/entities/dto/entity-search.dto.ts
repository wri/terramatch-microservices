import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export const FUZZY_SEARCH_ENTITIES = ["sites"] as const;
export type FuzzySearchEntity = (typeof FUZZY_SEARCH_ENTITIES)[number];

export class EntitySearchParamsDto {
  @IsIn(FUZZY_SEARCH_ENTITIES)
  @ApiProperty({ enum: FUZZY_SEARCH_ENTITIES, description: "Entity type to search" })
  entity: FuzzySearchEntity;
}

export class EntitySearchQueryDto {
  @ApiProperty({ description: "Matched against the start of each word in the entity name" })
  @IsString()
  @IsNotEmpty()
  search: string;
}

@JsonApiDto({ type: "entitySearchResults" })
export class EntitySearchResultDto {
  constructor(data: EntitySearchResultDto) {
    populateDto<EntitySearchResultDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}
