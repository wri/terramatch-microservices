import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Attributes } from "sequelize";
import { Geometry } from "geojson";

interface DataCompletenessValidationResult extends ValidationResult {
  extraInfo: Array<{
    field: string;
    error: string;
    exists: boolean;
  }> | null;
}

const VALIDATION_FIELDS: (keyof Attributes<SitePolygon>)[] = [
  "polyName",
  "practice",
  "targetSys",
  "distr",
  "numTrees",
  "plantStart"
];

const FIELD_NAME_MAP: Record<string, string> = {
  polyName: "poly_name",
  practice: "practice",
  targetSys: "target_sys",
  distr: "distr",
  numTrees: "num_trees",
  plantStart: "plantstart"
};

const VALID_PRACTICES = ["tree-planting", "direct-seeding", "assisted-natural-regeneration"];

const VALID_SYSTEMS = [
  "agroforest",
  "grassland",
  "natural-forest",
  "mangrove",
  "peatland",
  "riparian-area-or-wetland",
  "silvopasture",
  "woodlot-or-plantation",
  "urban-forest"
];

const VALID_DISTRIBUTIONS = ["single-line", "partial", "full"];

export class DataCompletenessValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<DataCompletenessValidationResult> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid },
      attributes: VALIDATION_FIELDS
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`No site polygon found with polygon UUID ${polygonUuid}`);
    }

    const validationErrors = this.validateSitePolygonData(sitePolygon);
    const valid = validationErrors.length === 0;

    return {
      valid,
      extraInfo: validationErrors.length > 0 ? validationErrors : null
    };
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

      const validationErrors = this.validateSitePolygonData(sitePolygon);
      const valid = validationErrors.length === 0;

      return {
        polygonUuid,
        valid,
        extraInfo: validationErrors.length > 0 ? validationErrors : null
      };
    });
  }

  private validateSitePolygonData(sitePolygon: SitePolygon): Array<{
    field: string;
    error: string;
    exists: boolean;
  }> {
    const validationErrors: Array<{
      field: string;
      error: string;
      exists: boolean;
    }> = [];

    for (const field of VALIDATION_FIELDS) {
      const value = sitePolygon[field];
      if (this.isInvalidField(field, value)) {
        validationErrors.push({
          field: FIELD_NAME_MAP[field] ?? field,
          error: this.getFieldError(field, value),
          exists: value != null && value !== ""
        });
      }
    }

    return validationErrors;
  }

  private isInvalidField(field: string, value: unknown): boolean {
    if (value == null || value === "") {
      return true;
    }

    switch (field) {
      case "plantStart":
        return !this.isValidDate(value);
      case "practice":
        return typeof value === "string" ? !this.areValidItems(value, VALID_PRACTICES) : true;
      case "targetSys":
        return typeof value === "string" ? !this.areValidItems(value, VALID_SYSTEMS) : true;
      case "distr":
        return typeof value === "string" ? !this.areValidItems(value, VALID_DISTRIBUTIONS) : true;
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

  private areValidItems(value: string, validItems: string[]): boolean {
    const items = value.split(",");
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

    const validationErrors = this.validateProperties(properties);
    const valid = validationErrors.length === 0;

    return {
      valid,
      extraInfo: validationErrors.length > 0 ? validationErrors : null
    };
  }

  private validateProperties(properties: Record<string, unknown>): Array<{
    field: string;
    error: string;
    exists: boolean;
  }> {
    const validationErrors: Array<{
      field: string;
      error: string;
      exists: boolean;
    }> = [];

    // Map property names from GeoJSON to SitePolygon field names
    const propertyMap: Record<string, keyof typeof FIELD_NAME_MAP> = {
      poly_name: "polyName",
      practice: "practice",
      target_sys: "targetSys",
      distr: "distr",
      num_trees: "numTrees",
      plantstart: "plantStart"
    };

    for (const [propertyKey, fieldKey] of Object.entries(propertyMap)) {
      const value = properties[propertyKey];
      if (this.isInvalidField(fieldKey, value)) {
        validationErrors.push({
          field: FIELD_NAME_MAP[fieldKey] ?? propertyKey,
          error: this.getFieldError(fieldKey, value),
          exists: value != null && value !== ""
        });
      }
    }

    return validationErrors;
  }
}
