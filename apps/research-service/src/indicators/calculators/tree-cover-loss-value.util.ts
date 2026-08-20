import { BadRequestException } from "@nestjs/common";
import { TreeCoverLossData } from "@terramatch-microservices/database/constants";

export const TREE_COVER_LOSS_YEARS_BEFORE_PLANT_START = 10;

export function getTreeCoverLossYearRange(plantStart: Date): { startYear: number; endYear: number } {
  const endYear = plantStart.getFullYear();
  return { startYear: endYear - TREE_COVER_LOSS_YEARS_BEFORE_PLANT_START, endYear };
}

export function assertValidPlantStart(plantStart: Date | null, polygonUuid: string): Date {
  if (plantStart == null || isNaN(plantStart.getTime())) {
    throw new BadRequestException(`Site polygon ${polygonUuid} has no valid plantStart`);
  }

  return plantStart;
}

export function buildZeroTreeCoverLossValueForRange(startYear: number, endYear: number): TreeCoverLossData {
  const value: TreeCoverLossData = {};
  for (let year = startYear; year <= endYear; year++) {
    value[year.toString()] = 0;
  }
  return value;
}

export function buildTreeCoverLossValue<T extends { area__ha: number }>(
  results: T[],
  getYear: (result: T) => number,
  plantStart: Date
): TreeCoverLossData {
  const { startYear, endYear } = getTreeCoverLossYearRange(plantStart);
  const value = buildZeroTreeCoverLossValueForRange(startYear, endYear);

  for (const result of results) {
    const year = getYear(result);
    if (year >= startYear && year <= endYear) {
      value[year.toString()] = result.area__ha;
    }
  }

  return value;
}
