import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ESTABLISHMENT_ENTITIES, EstablishmentEntity } from "../tree.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class EstablishmentsTreesParamsDto extends SingleResourceDto {
  @IsIn(ESTABLISHMENT_ENTITIES)
  @ApiProperty({
    enum: ESTABLISHMENT_ENTITIES,
    description: "Entity type for which to retrieve the establishment tree data."
  })
  entity: EstablishmentEntity;
}
