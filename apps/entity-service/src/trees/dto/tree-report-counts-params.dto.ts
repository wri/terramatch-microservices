import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class TreeReportCountsParamsDto extends SingleResourceDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({
    enum: ENTITY_TYPES,
    description: "Entity type for which to retrieve the associated report count data."
  })
  entity: EntityType;
}
