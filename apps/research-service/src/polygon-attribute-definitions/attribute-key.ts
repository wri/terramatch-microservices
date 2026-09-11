import { BadRequestException } from "@nestjs/common";
import { camelCase } from "lodash";

export const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const RESERVED_POLYGON_ATTRIBUTE_KEYS = [
  "uuid",
  "polyName",
  "plantStart",
  "practice",
  "targetSys",
  "distr",
  "numTrees",
  "siteId",
  "ppcExternalId"
] as const;

export function generateAttributeKey(label: string): string {
  return camelCase(label);
}

export function assertValidGeneratedKey(key: string, label: string): void {
  if (key === "" || !ATTRIBUTE_KEY_PATTERN.test(key)) {
    throw new BadRequestException(`Could not generate a valid identifier from label "${label}"`);
  }
}

export function assertNotReservedAttributeKey(key: string): void {
  if ((RESERVED_POLYGON_ATTRIBUTE_KEYS as readonly string[]).includes(key)) {
    throw new BadRequestException(`Attribute key "${key}" is reserved`);
  }
}
