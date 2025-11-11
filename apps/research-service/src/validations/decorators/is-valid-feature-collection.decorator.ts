import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments
} from "class-validator";
import { validateFeatureCollectionStructure } from "../utils/geojson-structure-validator";

@ValidatorConstraint({ name: "isValidFeatureCollection", async: false })
export class IsValidFeatureCollectionConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validateFeatureCollectionStructure(value).valid;
  }

  defaultMessage(args: ValidationArguments): string {
    const result = validateFeatureCollectionStructure(args.value);
    return result.error ?? `${args.property} must be a valid FeatureCollection`;
  }
}

export function IsValidFeatureCollection(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: "isValidFeatureCollection",
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      constraints: [],
      validator: IsValidFeatureCollectionConstraint
    });
  };
}
