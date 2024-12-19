// The entities that are able to ask for what their establishment tree data was.
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { ESTABLISHMENT_ENTITIES, EstablishmentEntity } from "../tree.service";

export class EstablishmentsTreesParamsDto {
  @IsIn(ESTABLISHMENT_ENTITIES)
  @ApiProperty({
    enum: ESTABLISHMENT_ENTITIES,
    description: "Entity type for which to retrieve the establishment tree data."
  })
  entity: EstablishmentEntity;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for which to retrieve the establishment tree data." })
  uuid: string;
}
