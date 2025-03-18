import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ENTITIES, ProcessableEntity } from "../entities.service";

export class SpecificEntityDto {
  @IsIn(PROCESSABLE_ENTITIES)
  @ApiProperty({ enum: PROCESSABLE_ENTITIES, description: "Entity type to retrieve" })
  entity: ProcessableEntity;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for resource to retrieve" })
  uuid: string;
}
