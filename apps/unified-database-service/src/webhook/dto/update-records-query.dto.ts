import { ENTITY_TYPES, EntityType } from "../../airtable/airtable.processor";
import { IsDate, IsIn, IsInt, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateRecordsQueryDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({
    enum: ENTITY_TYPES,
    description: "Entity type to update in Airtable",
    example: "project"
  })
  entityType: EntityType;

  @IsInt()
  @IsOptional()
  @ApiProperty({ description: "The page to start processing on.", required: false })
  startPage?: number;

  @IsDate()
  @IsOptional()
  @ApiProperty({ description: "The timestamp from which to look for updated records", required: false })
  updatedSince?: Date;
}
