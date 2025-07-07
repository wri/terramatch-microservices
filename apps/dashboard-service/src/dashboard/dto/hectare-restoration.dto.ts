import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "hectareRestoration" })
export class HectareRestorationDto {
  constructor(data: HectareRestorationDto) {
    populateDto<HectareRestorationDto>(this, data);
  }

  @ApiProperty()
  @IsObject()
  restorationStrategiesRepresented: Record<string, number>;

  @ApiProperty()
  @IsObject()
  targetLandUseTypesRepresented: Record<string, number>;
}
