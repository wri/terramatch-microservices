import { Type } from "@nestjs/common";
import { JsonApiAttributesInput, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

export abstract class EntityDto {
  protected populate<DTO extends EntityDto>(dtoClass: Type<DTO>, source: JsonApiAttributesInput<DTO>) {
    Object.assign(this, pickApiProperties(source, dtoClass));
  }

  /**
   * All EntityDtos must include a "lightResource" boolean to indicate if the resource that the
   * client currently has cached is a full version of that resource or not.
   **/
  @ApiProperty({
    type: Boolean,
    description: "Indicates if this resource has the full resource definition."
  })
  lightResource: boolean;
}
