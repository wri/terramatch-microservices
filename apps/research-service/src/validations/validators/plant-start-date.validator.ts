import { SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";

interface PlantStartDateValidationResult extends ValidationResult {
  extraInfo: {
    errorType: string;
    polygonUuid: string;
    polygonName?: string;
    siteName?: string;
    providedValue?: string;
    minDate?: string;
    currentDate?: string;
    siteStartDate?: string;
    allowedRange?: {
      min: string;
      max: string;
    };
    errorDetails?: string;
  } | null;
}

const MIN_DATE = "2018-01-01";

export class PlantStartDateValidator implements Validator {
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
          errorType: "MISSING_VALUE",
          polygonUuid,
          polygonName: sitePolygon.polyName ?? undefined,
          siteName: sitePolygon.site?.name ?? undefined
        }
      };
    }

    if (plantStartString === "0000-00-00") {
      return {
        valid: false,
        extraInfo: {
          errorType: "INVALID_FORMAT",
          polygonUuid,
          polygonName: sitePolygon.polyName ?? undefined,
          siteName: sitePolygon.site?.name ?? undefined,
          providedValue: plantStartString
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
            errorType: "PARSE_ERROR",
            polygonUuid,
            polygonName: sitePolygon.polyName ?? undefined,
            siteName: sitePolygon.site?.name ?? undefined,
            providedValue: plantStartString,
            errorDetails: plantStartDate.invalidReason ?? "Invalid date format"
          }
        };
      }

      if (plantStartDate < minDate) {
        return {
          valid: false,
          extraInfo: {
            errorType: "DATE_TOO_EARLY",
            polygonUuid,
            polygonName: sitePolygon.polyName ?? undefined,
            siteName: sitePolygon.site?.name ?? undefined,
            providedValue: plantStartString,
            minDate: MIN_DATE
          }
        };
      }

      if (plantStartDate > currentDate) {
        return {
          valid: false,
          extraInfo: {
            errorType: "DATE_IN_FUTURE",
            polygonUuid,
            polygonName: sitePolygon.polyName ?? undefined,
            siteName: sitePolygon.site?.name ?? undefined,
            providedValue: plantStartString,
            currentDate: currentDate.toISODate()
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
              errorType: "PARSE_ERROR",
              polygonUuid,
              polygonName: sitePolygon.polyName ?? undefined,
              siteName: sitePolygon.site.name ?? undefined,
              providedValue: plantStartString,
              errorDetails: `Invalid site start date: ${siteStartDate.invalidReason}`
            }
          };
        }

        const twoYearsBefore = siteStartDate.minus({ years: 2 });
        const twoYearsAfter = siteStartDate.plus({ years: 2 });

        if (plantStartDate < twoYearsBefore || plantStartDate > twoYearsAfter) {
          return {
            valid: false,
            extraInfo: {
              errorType: "DATE_OUTSIDE_SITE_RANGE",
              polygonUuid,
              polygonName: sitePolygon.polyName ?? undefined,
              siteName: sitePolygon.site.name ?? undefined,
              providedValue: plantStartString,
              siteStartDate: siteStartDate.toISODate(),
              allowedRange: {
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
          errorType: "PARSE_ERROR",
          polygonUuid,
          polygonName: sitePolygon.polyName ?? undefined,
          siteName: sitePolygon.site?.name ?? undefined,
          providedValue: plantStartString,
          errorDetails: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  }
}
