import { ValidateBy, ValidationOptions } from "class-validator";
import { isValidRoleCombination } from "@terramatch-microservices/database/constants/permissions";

export const IsValidRoleCombination = (validationOptions?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: "isValidRoleCombination",
      validator: {
        validate: (value: unknown) => !Array.isArray(value) || isValidRoleCombination(value),
        defaultMessage: () => "Only framework admin roles may be combined with other roles"
      }
    },
    validationOptions
  );
