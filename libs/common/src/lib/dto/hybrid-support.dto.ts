import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps } from "./json-api-attributes";

// The DTO constructor is expected to provide lightResource, so omit it from the additional props.
export type HybridSupportProps<DTO, Model> = Omit<AdditionalProps<DTO, Model>, "lightResource">;

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
}
