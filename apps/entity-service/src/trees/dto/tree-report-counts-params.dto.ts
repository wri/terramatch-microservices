import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

export class TreeReportCountsParamsDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({
    enum: ENTITY_TYPES,
    description: "Entity type for which to retrieve the associated report count data."
  })
  entity: EntityType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for which to retrieve the associated report count data." })
  uuid: string;
}
