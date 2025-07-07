import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "hectareRestoration" })
export class HectareRestorationDto {
  constructor(data: HectareRestorationDto) {
    populateDto<HectareRestorationDto>(this, data);
  }

  restorationStrategiesRepresented!: Record<string, number>;
  targetLandUseTypesRepresented!: Record<string, number>;
}
