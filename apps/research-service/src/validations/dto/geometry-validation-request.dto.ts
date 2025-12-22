import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ArrayMinSize, IsIn, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { NON_PERSISTENT_VALIDATION_TYPES, ValidationType } from "@terramatch-microservices/database/constants";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { FeatureCollection } from "geojson";
import { IsValidFeatureCollection } from "../decorators/is-valid-feature-collection.decorator";

export class GeometryValidationRequestAttributes {
  @ApiProperty({
    description: `Array of GeoJSON FeatureCollections containing geometries to validate.
    Properties support both camelCase and snake_case.
    camelCase takes precedence if both formats are present for the same property.`,
    type: "array",
    example: [
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [1, 0],
                  [0, 0]
                ]
              ]
            },
            properties: {
              siteId: "550e8400-e29b-41d4-a716-446655440000",
              polyName: "Test Polygon"
            }
          }
        ]
      }
    ]
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Object)
  @IsValidFeatureCollection()
  geometries: FeatureCollection[];

  @ApiProperty({
    enum: NON_PERSISTENT_VALIDATION_TYPES,
    isArray: true,
    required: false,
    description:
      "Array of validation types to run. If not provided or empty, all non persistent validation types will be run.",
    example: ["DUPLICATE_GEOMETRY"]
  })
  @IsOptional()
  @IsArray()
  @IsIn(NON_PERSISTENT_VALIDATION_TYPES, { each: true })
  validationTypes?: ValidationType[];
}

export class GeometryValidationRequestBody extends JsonApiBodyDto(
  class GeometryValidationRequestData extends CreateDataDto(
    "geometryValidations",
    GeometryValidationRequestAttributes
  ) {}
) {}
