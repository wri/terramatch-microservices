import { ENTITY_TYPES, EntityType } from "../../airtable/airtable.processor";
import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateRecordsQueryDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({
    enum: ENTITY_TYPES,
    description: "Entity type to update in Airtable",
    example: "project"
  })
  entityType: EntityType;

  @ApiProperty({ description: "The page to start processing on.", required: false })
  startPage?: number;
}
