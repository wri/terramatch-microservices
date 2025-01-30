import { ENTITY_TYPES, EntityType } from "../../airtable/airtable.processor";
import { IsDate, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class DeleteRecordsQueryDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({
    enum: ENTITY_TYPES,
    description: "Entity type to update in Airtable",
    example: "project"
  })
  entityType: EntityType;

  @IsDate()
  @ApiProperty({ description: "The timestamp from which to look for deleted records" })
  deletedSince: Date;
}
