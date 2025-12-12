import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PROCESSABLE_ENTITIES, ProcessableEntity } from "../entities.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class SpecificEntityDto extends SingleResourceDto {
  @IsIn(PROCESSABLE_ENTITIES)
  @ApiProperty({ enum: PROCESSABLE_ENTITIES, description: "Entity type to retrieve" })
  entity: ProcessableEntity;
}
