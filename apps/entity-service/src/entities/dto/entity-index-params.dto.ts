import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ENTITIES, ProcessableEntity } from "../entities.service";

export class EntityIndexParamsDto {
  @IsIn(PROCESSABLE_ENTITIES)
  @ApiProperty({ enum: PROCESSABLE_ENTITIES, description: "Entity type to retrieve" })
  entity: ProcessableEntity;
}
