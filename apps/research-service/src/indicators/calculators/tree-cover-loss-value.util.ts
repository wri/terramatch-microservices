import { TreeCoverLossData } from "@terramatch-microservices/database/constants";

/** First year of UMD tree cover loss data used when GFW returns no intersecting pixels. */
export const TREE_COVER_LOSS_START_YEAR = 2015;

export function buildZeroTreeCoverLossValue(yearOfAnalysis: number): TreeCoverLossData {
  const value: TreeCoverLossData = {};
  for (let year = TREE_COVER_LOSS_START_YEAR; year <= yearOfAnalysis; year++) {
    value[year.toString()] = 0;
  }
  return value;
}

export function buildTreeCoverLossValue<T extends { area__ha: number }>(
  results: T[],
  getYear: (result: T) => number,
  yearOfAnalysis: number
): TreeCoverLossData {
  if (results.length === 0) {
    return buildZeroTreeCoverLossValue(yearOfAnalysis);
  }

  return results.reduce((acc, result) => {
    acc[getYear(result).toString()] = result.area__ha;
    return acc;
  }, {} as TreeCoverLossData);
}
