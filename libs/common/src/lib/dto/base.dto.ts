import { ApiProperty } from "@nestjs/swagger";
import { Type } from "@nestjs/common";

export abstract class BaseDto {
  /**
   * All DTOs must include a "lightResource" boolean to indicate if the resource that the
   * client currently has cached is a full version of that resource or not.
   **/
  @ApiProperty({
    type: Boolean,
    description: "Indicates if this resource has the full resource definition."
  })
  lightResource: boolean;

  protected populate<T>(dtoClass: Type<T>, values: Partial<T>) {
    Object.assign(this, values);
  }
}
