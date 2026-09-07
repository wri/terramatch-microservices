import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityStatus } from "@terramatch-microservices/database/constants/status";

/**
 * The shape returned by the rollup query in SitePolygonsService.getSiteReviewRollup. Numeric fields
 * arrive from the driver as strings or numbers depending on the aggregate, so the DTO normalises.
 */
export type SiteReviewRollupRow = {
  siteUuid: string;
  siteName: string | null;
  siteStatus: EntityStatus | null;
  activeTotal: number | string;
  passed: number | string;
  partial: number | string;
  failed: number | string;
  notChecked: number | string;
  approved: number | string;
  pendingApproval: number | string;
  draft: number | string;
  informationRequired: number | string;
  overlapCount: number | string;
  hectares: number | string | null;
  centroidLat: number | string | null;
  centroidLong: number | string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Per-site review rollup for a project, over every active, non-deleted polygon on every
 * non-deleted site — the basis a reviewer needs (unlike SiteIndicatorRollupDto, which counts
 * approved polygons only). Sites with zero active polygons still get a row (via LEFT JOIN):
 * omitting the row would assert the site does not exist, which is a stronger and falser claim
 * than "nothing to review yet".
 */
@JsonApiDto({ type: "siteReviewRollups" })
export class SiteReviewRollupDto {
  constructor(row: SiteReviewRollupRow) {
    this.siteUuid = row.siteUuid;
    this.siteName = row.siteName;
    this.siteStatus = row.siteStatus;
    this.activeTotal = toNumber(row.activeTotal) ?? 0;
    this.passed = toNumber(row.passed) ?? 0;
    this.partial = toNumber(row.partial) ?? 0;
    this.failed = toNumber(row.failed) ?? 0;
    this.notChecked = toNumber(row.notChecked) ?? 0;
    this.approved = toNumber(row.approved) ?? 0;
    this.pendingApproval = toNumber(row.pendingApproval) ?? 0;
    this.draft = toNumber(row.draft) ?? 0;
    this.informationRequired = toNumber(row.informationRequired) ?? 0;
    this.overlapCount = toNumber(row.overlapCount) ?? 0;
    this.hectares = toNumber(row.hectares);
    this.centroidLat = toNumber(row.centroidLat);
    this.centroidLong = toNumber(row.centroidLong);
  }

  @ApiProperty({ description: "UUID of the site this row rolls up." })
  siteUuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Name of the site." })
  siteName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Status of the site." })
  siteStatus: EntityStatus | null;

  @ApiProperty({ description: "Count of active, non-deleted polygons on this site." })
  activeTotal: number;

  @ApiProperty({ description: "Active polygons with validationStatus = 'passed'." })
  passed: number;

  @ApiProperty({ description: "Active polygons with validationStatus = 'partial'." })
  partial: number;

  @ApiProperty({ description: "Active polygons with validationStatus = 'failed'." })
  failed: number;

  @ApiProperty({ description: "Active polygons with no validation result yet (null or 'not_checked')." })
  notChecked: number;

  @ApiProperty({ description: "Active polygons with status = 'approved'." })
  approved: number;

  @ApiProperty({ description: "Active polygons with status = 'pending-approval'." })
  pendingApproval: number;

  @ApiProperty({ description: "Active polygons with status = 'draft'." })
  draft: number;

  @ApiProperty({ description: "Active polygons with status = 'information-required'." })
  informationRequired: number;

  @ApiProperty({
    description:
      "Active polygons on this site with a failed OVERLAPPING validation criterion (same-site or cross-site, undifferentiated)."
  })
  overlapCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Sum of calc_area over this site's active polygons. Null when there are none."
  })
  hectares: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Mean latitude over this site's active polygons; a marker, not a boundary. Null when there are none."
  })
  centroidLat: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Mean longitude over this site's active polygons; a marker, not a boundary. Null when there are none."
  })
  centroidLong: number | null;
}
