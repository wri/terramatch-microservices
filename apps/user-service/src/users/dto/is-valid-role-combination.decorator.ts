import { ValidateBy, ValidationOptions } from "class-validator";
import {
  FRAMEWORK_ADMIN_ROLES,
  isValidRoleCombination
} from "@terramatch-microservices/database/constants/permissions";

export const ROLE_COMBINATION_DESCRIPTION = `Only framework admin roles (${FRAMEWORK_ADMIN_ROLES.join(
  ", "
)}) may be combined; any other role must be the user's only role.`;

export const IsValidRoleCombination = (validationOptions?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: "isValidRoleCombination",
      validator: {
        validate: (value: unknown) => !Array.isArray(value) || isValidRoleCombination(value),
        defaultMessage: () => ROLE_COMBINATION_DESCRIPTION
      }
    },
    validationOptions
  );
