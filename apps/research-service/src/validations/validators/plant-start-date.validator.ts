import { SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { PolygonValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";

interface PlantStartDateValidationResult extends ValidationResult {
  extraInfo: {
    error_type: string;
    polygon_uuid: string;
    polygon_name?: string;
    site_name?: string;
    provided_value?: string;
    min_date?: string;
    current_date?: string;
    site_start_date?: string;
    allowed_range?: {
      min: string;
      max: string;
    };
    error_details?: string;
  } | null;
}

const MIN_DATE = "2018-01-01";

export class PlantStartDateValidator implements PolygonValidator {
  async validatePolygon(polygonUuid: string): Promise<PlantStartDateValidationResult> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid },
      attributes: ["polyName", "plantStart", "siteUuid"],
      include: [
        {
          model: Site,
          as: "site",
          attributes: ["name", "startDate"]
        }
      ]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon with UUID ${polygonUuid} not found`);
    }

    const validationResult = this.validatePlantStartDate(sitePolygon, polygonUuid);
    return {
      valid: validationResult.valid,
      extraInfo: validationResult.extraInfo
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const sitePolygons = await SitePolygon.findAll({
      where: { polygonUuid: polygonUuids },
      attributes: ["polygonUuid", "polyName", "plantStart", "siteUuid"],
      include: [
        {
          model: Site,
          as: "site",
          attributes: ["name", "startDate"]
        }
      ]
    });

    return sitePolygons.map(sitePolygon => {
      const validationResult = this.validatePlantStartDate(sitePolygon, sitePolygon.polygonUuid);
      return {
        polygonUuid: sitePolygon.polygonUuid,
        valid: validationResult.valid,
        extraInfo: validationResult.extraInfo
      };
    });
  }

  private validatePlantStartDate(
    sitePolygon: SitePolygon,
    polygonUuid: string
  ): {
    valid: boolean;
    extraInfo: PlantStartDateValidationResult["extraInfo"];
  } {
    const plantStart = sitePolygon.plantStart;
    const plantStartString =
      plantStart instanceof Date
        ? DateTime.fromJSDate(plantStart, { zone: "utc" }).toISODate() ?? undefined
        : plantStart ?? undefined;

    if (plantStart == null || plantStartString === "") {
      return {
        valid: false,
        extraInfo: {
          error_type: "MISSING_VALUE",
          polygon_uuid: polygonUuid,
          polygon_name: sitePolygon.polyName ?? undefined,
          site_name: sitePolygon.site?.name ?? undefined
        }
      };
    }

    if (plantStartString === "0000-00-00") {
      return {
        valid: false,
        extraInfo: {
          error_type: "INVALID_FORMAT",
          polygon_uuid: polygonUuid,
          polygon_name: sitePolygon.polyName ?? undefined,
          site_name: sitePolygon.site?.name ?? undefined,
          provided_value: plantStartString
        }
      };
    }

    try {
      const plantStartDate = DateTime.fromISO(plantStartString ?? "");
      const minDate = DateTime.fromISO(MIN_DATE);
      const currentDate = DateTime.now();

      if (!plantStartDate.isValid) {
        return {
          valid: false,
          extraInfo: {
            error_type: "PARSE_ERROR",
            polygon_uuid: polygonUuid,
            polygon_name: sitePolygon.polyName ?? undefined,
            site_name: sitePolygon.site?.name ?? undefined,
            provided_value: plantStartString,
            error_details: plantStartDate.invalidReason ?? "Invalid date format"
          }
        };
      }

      if (plantStartDate < minDate) {
        return {
          valid: false,
          extraInfo: {
            error_type: "DATE_TOO_EARLY",
            polygon_uuid: polygonUuid,
            polygon_name: sitePolygon.polyName ?? undefined,
            site_name: sitePolygon.site?.name ?? undefined,
            provided_value: plantStartString,
            min_date: MIN_DATE
          }
        };
      }

      if (plantStartDate > currentDate) {
        return {
          valid: false,
          extraInfo: {
            error_type: "DATE_IN_FUTURE",
            polygon_uuid: polygonUuid,
            polygon_name: sitePolygon.polyName ?? undefined,
            site_name: sitePolygon.site?.name ?? undefined,
            provided_value: plantStartString,
            current_date: currentDate.toISODate()
          }
        };
      }

      if (sitePolygon.site?.startDate != null) {
        const siteStartDateString =
          sitePolygon.site.startDate instanceof Date
            ? DateTime.fromJSDate(sitePolygon.site.startDate, { zone: "utc" }).toISODate()
            : sitePolygon.site.startDate;
        const siteStartDate = DateTime.fromISO(siteStartDateString ?? "");

        if (!siteStartDate.isValid) {
          return {
            valid: false,
            extraInfo: {
              error_type: "PARSE_ERROR",
              polygon_uuid: polygonUuid,
              polygon_name: sitePolygon.polyName ?? undefined,
              site_name: sitePolygon.site.name ?? undefined,
              provided_value: plantStartString,
              error_details: `Invalid site start date: ${siteStartDate.invalidReason}`
            }
          };
        }

        const twoYearsBefore = siteStartDate.minus({ years: 2 });
        const twoYearsAfter = siteStartDate.plus({ years: 2 });

        if (plantStartDate < twoYearsBefore || plantStartDate > twoYearsAfter) {
          return {
            valid: false,
            extraInfo: {
              error_type: "DATE_OUTSIDE_SITE_RANGE",
              polygon_uuid: polygonUuid,
              polygon_name: sitePolygon.polyName ?? undefined,
              site_name: sitePolygon.site.name ?? undefined,
              provided_value: plantStartString,
              site_start_date: siteStartDate.toISODate(),
              allowed_range: {
                min: twoYearsBefore.toISODate(),
                max: twoYearsAfter.toISODate()
              }
            }
          };
        }
      }

      return {
        valid: true,
        extraInfo: null
      };
    } catch (error) {
      return {
        valid: false,
        extraInfo: {
          error_type: "PARSE_ERROR",
          polygon_uuid: polygonUuid,
          polygon_name: sitePolygon.polyName ?? undefined,
          site_name: sitePolygon.site?.name ?? undefined,
          provided_value: plantStartString,
          error_details: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  }
}
