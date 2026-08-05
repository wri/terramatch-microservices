import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  SITE_POLYGON_DISTRIBUTIONS,
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_TARGET_SYSTEMS
} from "@terramatch-microservices/database/constants";
import { PolygonValidator, GeometryValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Attributes } from "sequelize";
import { Geometry } from "geojson";
import { isArray } from "lodash";

type ValidationError = {
  field: string;
  error: string;
  exists: boolean;
};

interface DataCompletenessValidationResult extends ValidationResult {
  extraInfo: ValidationError[] | null;
}

const VALIDATION_FIELDS: (keyof Attributes<SitePolygon>)[] = [
  "polyName",
  "practice",
  "targetSys",
  "distr",
  "numTrees",
  "plantStart"
];

// Uploaded GeoJSON can come from external GIS tools that use snake_case properties. This map is
// only used to read those legacy input property names - it has no bearing on the (camelCase)
// shape of the `extraInfo` this validator produces.
const LEGACY_SNAKE_CASE_PROPERTY_ALIASES: Record<string, string> = {
  polyName: "poly_name",
  targetSys: "target_sys",
  numTrees: "num_trees",
  plantStart: "plantstart"
};

function getPropertyValue(properties: Record<string, unknown>, camelCaseKey: string): unknown {
  if (properties[camelCaseKey] != null) return properties[camelCaseKey];
  const snakeCaseKey = LEGACY_SNAKE_CASE_PROPERTY_ALIASES[camelCaseKey];
  return snakeCaseKey == null ? undefined : properties[snakeCaseKey];
}

const VALID_PRACTICES = [...SITE_POLYGON_PRACTICES];

const VALID_SYSTEMS = [...SITE_POLYGON_TARGET_SYSTEMS];

const VALID_DISTRIBUTIONS = [...SITE_POLYGON_DISTRIBUTIONS];

export class DataCompletenessValidator implements PolygonValidator, GeometryValidator {
  async validatePolygon(polygonUuid: string): Promise<DataCompletenessValidationResult> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid },
      attributes: VALIDATION_FIELDS
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`No site polygon found with polygon UUID ${polygonUuid}`);
    }

    const validationErrors = this.validateFields(
      VALIDATION_FIELDS,
      field => sitePolygon[field as keyof typeof sitePolygon]
    );
    return this.buildValidationResult(validationErrors);
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const sitePolygons = await SitePolygon.findAll({
      where: { polygonUuid: polygonUuids },
      attributes: ["polygonUuid", ...VALIDATION_FIELDS]
    });

    const resultMap = new Map(sitePolygons.map(sp => [sp.polygonUuid, sp]));

    return polygonUuids.map(polygonUuid => {
      const sitePolygon = resultMap.get(polygonUuid);
      if (sitePolygon == null) {
        return {
          polygonUuid,
          valid: false,
          extraInfo: { error: "Site polygon not found" }
        };
      }

      const validationErrors = this.validateFields(
        VALIDATION_FIELDS,
        field => sitePolygon[field as keyof typeof sitePolygon]
      );

      return {
        polygonUuid,
        valid: validationErrors.length === 0,
        extraInfo: validationErrors.length > 0 ? validationErrors : null
      };
    });
  }

  private validateFields(fields: string[], getValue: (field: string) => unknown): ValidationError[] {
    const validationErrors: ValidationError[] = [];

    for (const field of fields) {
      const value = getValue(field);
      if (this.isInvalidField(field, value)) {
        validationErrors.push({
          field,
          error: this.getFieldError(field, value),
          exists: this.valueExists(value)
        });
      }
    }

    return validationErrors;
  }

  private valueExists(value: unknown): boolean {
    return value != null && value !== "";
  }

  private buildValidationResult(validationErrors: ValidationError[]): DataCompletenessValidationResult {
    return {
      valid: validationErrors.length === 0,
      extraInfo: validationErrors.length > 0 ? validationErrors : null
    };
  }

  private isInvalidField(field: string, value: unknown): boolean {
    if (value == null || value === "") {
      return true;
    }

    switch (field) {
      case "plantStart":
        return !this.isValidDate(value);
      case "practice":
        return isArray(value) ? !this.areValidItems(value, VALID_PRACTICES) : true;
      case "targetSys":
        return typeof value === "string" ? !this.areValidItems(value, VALID_SYSTEMS) : true;
      case "distr":
        return isArray(value) ? !this.areValidItems(value, VALID_DISTRIBUTIONS) : true;
      case "numTrees":
        return !this.isValidInteger(value);
      default:
        return false;
    }
  }

  private getFieldError(field: string, value: unknown): string {
    if (value == null || value === "") {
      return "Field is required";
    }

    switch (field) {
      case "plantStart":
        return "Invalid date format. Expected YYYY-MM-DD";
      case "practice":
        return `Invalid practice. Must be one of: ${VALID_PRACTICES.join(", ")}`;
      case "targetSys":
        return `Invalid target system. Must be one of: ${VALID_SYSTEMS.join(", ")}`;
      case "distr":
        return `Invalid distribution. Must be one of: ${VALID_DISTRIBUTIONS.join(", ")}`;
      case "numTrees":
        return "Invalid number of trees. Must be a valid integer and cannot be 0";
      default:
        return "Invalid value";
    }
  }

  private areValidItems(value: string | string[], validItems: string[]): boolean {
    const items = isArray(value) ? value : value.split(",");
    return items.every(item => validItems.includes(item.trim()));
  }

  private isValidDate(date: unknown): boolean {
    if (typeof date === "string") {
      const d = new Date(date);
      return !isNaN(d.getTime()) && d.toISOString().split("T")[0] === date;
    }
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    return false;
  }

  private isValidInteger(value: unknown): boolean {
    return Number.isInteger(Number(value)) && Number(value) > 0;
  }

  async validateGeometry(
    geometry: Geometry,
    properties?: Record<string, unknown>
  ): Promise<DataCompletenessValidationResult> {
    if (properties == null) {
      return {
        valid: false,
        extraInfo: [
          {
            field: "properties",
            error: "Feature properties are required",
            exists: false
          }
        ]
      };
    }

    // Validate using camelCase field names, falling back to legacy snake_case input properties
    const validationErrors = this.validateFields(VALIDATION_FIELDS, field => getPropertyValue(properties, field));

    return this.buildValidationResult(validationErrors);
  }
}
