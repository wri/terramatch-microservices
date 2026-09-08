import { BadRequestException } from "@nestjs/common";
import { literal, OrderItem } from "sequelize";

export const SITE_POLYGON_SORT_FIELDS = [
  "name",
  "status",
  "createdAt",
  "validationStatus",
  "plantStart",
  "numTrees",
  "calcArea",
  "targetSys",
  "submissionCycle",
  "source",
  "practice",
  "distr"
] as const;

export type SitePolygonSortField = (typeof SITE_POLYGON_SORT_FIELDS)[number];

const SIMPLE_SORT_COLUMNS: Partial<Record<SitePolygonSortField, string>> = {
  name: "polyName",
  status: "status",
  createdAt: "createdAt",
  validationStatus: "validationStatus",
  plantStart: "plantStart",
  numTrees: "numTrees",
  calcArea: "calcArea",
  targetSys: "targetSys",
  submissionCycle: "submissionCycle",
  source: "source"
};

const PRACTICE_SORT_CODES = [
  "assisted-natural-regeneration",
  "direct-seeding",
  "sapling-planting",
  "tree-planting"
] as const;

const DISTR_SORT_CODES = ["full", "partial", "single-line"] as const;

const sqlStringLiteral = (value: string): string => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

const buildJsonArrayJoinedCodeSortExpression = (column: "practice" | "distr", codes: readonly string[]): string => {
  const parts = codes.map(code => {
    const escapedCode = sqlStringLiteral(JSON.stringify(code));
    return `IF(JSON_CONTAINS(SitePolygon.${column}, ${escapedCode}, '$') = 1, ${sqlStringLiteral(code)}, NULL)`;
  });
  return `CONCAT_WS(', ', ${parts.join(", ")})`;
};

export const isSitePolygonSortField = (field: string): field is SitePolygonSortField =>
  (SITE_POLYGON_SORT_FIELDS as readonly string[]).includes(field);

export const buildSitePolygonSortOrder = (field: string, direction: "ASC" | "DESC" = "ASC"): OrderItem[] => {
  if (!isSitePolygonSortField(field)) {
    throw new BadRequestException(`Invalid sort field: ${field}`);
  }

  const simpleColumn = SIMPLE_SORT_COLUMNS[field];
  if (simpleColumn != null) {
    return [[simpleColumn, direction]];
  }

  if (field === "practice") {
    return [[literal(buildJsonArrayJoinedCodeSortExpression("practice", PRACTICE_SORT_CODES)), direction]];
  }

  if (field === "distr") {
    return [[literal(buildJsonArrayJoinedCodeSortExpression("distr", DISTR_SORT_CODES)), direction]];
  }

  throw new BadRequestException(`Invalid sort field: ${field}`);
};
