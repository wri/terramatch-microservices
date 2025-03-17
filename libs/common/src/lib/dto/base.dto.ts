import { ApiProperty } from "@nestjs/swagger";
import { Type } from "@nestjs/common";

export abstract class HybridSupportDto {
  /**
   * Indicates whether this DTO represents a light version of the resource.
   * This property is only relevant for DTOs that have both light and full versions.
   */
  @ApiProperty({
    type: Boolean,
    description: "Indicates if this resource has the full resource definition."
  })
  lightResource: boolean;

  protected populate<T>(dtoClass: Type<T>, values: Partial<T>) {
    Object.assign(this, values);
  }
}
