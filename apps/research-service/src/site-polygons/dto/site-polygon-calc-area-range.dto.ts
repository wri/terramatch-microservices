import { ApiProperty } from "@nestjs/swagger";
import {
  IsNumber,
  IsOptional,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";

@ValidatorConstraint({ name: "isOnOrAboveCalcAreaMin", async: false })
class IsOnOrAboveCalcAreaMinConstraint implements ValidatorConstraintInterface {
  validate(calcAreaMax: number, { object }: ValidationArguments) {
    const { calcAreaMin } = object as SitePolygonCalcAreaRangeDto;
    return calcAreaMin == null || calcAreaMin <= calcAreaMax;
  }

  defaultMessage() {
    return "calcAreaMin must be less than or equal to calcAreaMax";
  }
}

export class SitePolygonCalcAreaRangeDto {
  @ApiProperty({
    required: false,
    minimum: 0,
    description:
      "Inclusive lower bound for calculated area in hectares (calcArea). Polygons without calcArea are excluded."
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calcAreaMin?: number;

  @ApiProperty({
    required: false,
    minimum: 0,
    description:
      "Inclusive upper bound for calculated area in hectares (calcArea). Polygons without calcArea are excluded."
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Validate(IsOnOrAboveCalcAreaMinConstraint)
  calcAreaMax?: number;
}
