import { IsBoolean, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { applyDecorators } from "@nestjs/common";

type BooleanStringOptions = {
  /** @default true */
  optional?: boolean;
};
export const TransformBooleanString = ({ optional }: BooleanStringOptions = {}) => {
  const decorators = [
    IsBoolean(),
    Transform(({ key, obj }) => {
      const value = obj[key];
      if (value === "true") return true;
      if (value === "false") return false;
      return ""; // trigger the validation error from IsBoolean
    })
  ];
  if (optional !== false) {
    decorators.unshift(IsOptional());
  }
  return applyDecorators(...decorators);
};
