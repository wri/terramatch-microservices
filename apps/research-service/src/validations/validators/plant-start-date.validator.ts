import { SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";

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
      plantStart instanceof Date ? plantStart.toISOString().split("T")[0] : plantStart ?? undefined;

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
      const plantStartDate = new Date(plantStartString ?? "");
      const minDate = new Date(MIN_DATE);
      const currentDate = new Date();

      if (isNaN(plantStartDate.getTime())) {
        return {
          valid: false,
          extraInfo: {
            errorType: "PARSE_ERROR",
            polygonUuid,
            polygonName: sitePolygon.polyName ?? undefined,
            siteName: sitePolygon.site?.name ?? undefined,
            providedValue: plantStartString,
            errorDetails: "Invalid date format"
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
            currentDate: currentDate.toISOString().split("T")[0]
          }
        };
      }

      if (sitePolygon.site?.startDate != null) {
        const siteStartDateString =
          sitePolygon.site.startDate instanceof Date
            ? sitePolygon.site.startDate.toISOString().split("T")[0]
            : sitePolygon.site.startDate;
        const siteStartDate = new Date(siteStartDateString ?? "");

        if (isNaN(siteStartDate.getTime())) {
          return {
            valid: false,
            extraInfo: {
              errorType: "PARSE_ERROR",
              polygonUuid,
              polygonName: sitePolygon.polyName ?? undefined,
              siteName: sitePolygon.site.name ?? undefined,
              providedValue: plantStartString,
              errorDetails: "Invalid site start date"
            }
          };
        }

        const twoYearsBefore = new Date(siteStartDate);
        twoYearsBefore.setFullYear(siteStartDate.getFullYear() - 2);
        const twoYearsAfter = new Date(siteStartDate);
        twoYearsAfter.setFullYear(siteStartDate.getFullYear() + 2);

        if (plantStartDate < twoYearsBefore || plantStartDate > twoYearsAfter) {
          return {
            valid: false,
            extraInfo: {
              errorType: "DATE_OUTSIDE_SITE_RANGE",
              polygonUuid,
              polygonName: sitePolygon.polyName ?? undefined,
              siteName: sitePolygon.site.name ?? undefined,
              providedValue: plantStartString,
              siteStartDate: siteStartDate.toISOString().split("T")[0],
              allowedRange: {
                min: twoYearsBefore.toISOString().split("T")[0],
                max: twoYearsAfter.toISOString().split("T")[0]
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
