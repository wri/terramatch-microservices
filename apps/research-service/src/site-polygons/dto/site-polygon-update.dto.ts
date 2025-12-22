import { ApiProperty } from "@nestjs/swagger";
import { IndicatorDto } from "./site-polygon.dto";
import { Equals, IsArray, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { INDICATOR_DTOS } from "./indicators.dto";
import { JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

class SitePolygonUpdateAttributes {
  @IsArray()
  @ValidateNested()
  @Type(() => Object, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: "indicatorSlug",
      subTypes: Object.entries(INDICATOR_DTOS).map(([name, value]) => ({ name, value }))
    }
  })
  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: "#/components/schemas/IndicatorTreeCoverLossDto" },
        { $ref: "#/components/schemas/IndicatorHectaresDto" },
        { $ref: "#/components/schemas/IndicatorTreeCountDto" },
        { $ref: "#/components/schemas/IndicatorTreeCoverDto" },
        { $ref: "#/components/schemas/IndicatorFieldMonitoringDto" },
        { $ref: "#/components/schemas/IndicatorMsuCarbonDto" }
      ]
    },
    description: "All indicators to update for this polygon"
  })
  indicators: IndicatorDto[];
}

class SitePolygonUpdate {
  @Equals("sitePolygons")
  @ApiProperty({ enum: ["sitePolygons"] })
  type: string;

  @IsUUID()
  @ApiProperty({ format: "uuid" })
  id: string;

  @ValidateNested()
  @Type(() => SitePolygonUpdateAttributes)
  @ApiProperty({ type: () => SitePolygonUpdateAttributes })
  attributes: SitePolygonUpdateAttributes;
}

export class SitePolygonBulkUpdateBodyDto extends JsonApiBulkBodyDto(SitePolygonUpdate, {
  description: "Array of site polygons to update",
  minSize: 1
}) {}
