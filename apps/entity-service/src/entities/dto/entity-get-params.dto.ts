import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";
import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class EntityGetParamsDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({ enum: ENTITY_TYPES, description: "Entity type to retrieve" })
  entity: EntityType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for resource to retrieve" })
  uuid: string;
}
