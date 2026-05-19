import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { POLYGON_INFORMATION_REQUIRED, POLYGON_PENDING_APPROVAL } from "@terramatch-microservices/database/constants";
import { AuditStatus, SitePolygon } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";

const LEGACY_SUBMITTED = "submitted";
const LEGACY_NEEDS_MORE_INFORMATION = "needs-more-information";

const UPDATE_OPTIONS = { paranoid: false } as const;

type RenameSummary = {
  sitePolygonSubmitted: number;
  sitePolygonInformationRequired: number;
  auditStatusSubmitted: number;
  auditStatusInformationRequired: number;
};

/**
 * Renames legacy site polygon status values in `site_polygon` and related `audit_statuses` rows,
 * including soft-deleted (historical) records.
 *
 * Run in entity-service REPL (local or remote):
 *   await oneOff.renameSitePolygonStatuses()
 *
 * Safe to re-run: only rows still on legacy status values are updated.
 */
export const renameSitePolygonStatuses = withoutSqlLogs(async (): Promise<RenameSummary> => {
  const sequelize = SitePolygon.sequelize;
  if (sequelize == null) throw new Error("SitePolygon sequelize instance not available");

  const summary = await sequelize.transaction(async (transaction: Transaction) => {
    const [sitePolygonSubmitted] = await SitePolygon.update(
      { status: POLYGON_PENDING_APPROVAL },
      { where: { status: LEGACY_SUBMITTED }, transaction, ...UPDATE_OPTIONS }
    );
    const [sitePolygonInformationRequired] = await SitePolygon.update(
      { status: POLYGON_INFORMATION_REQUIRED },
      { where: { status: LEGACY_NEEDS_MORE_INFORMATION }, transaction, ...UPDATE_OPTIONS }
    );

    const sitePolygonAuditWhere = { auditableType: SitePolygon.LARAVEL_TYPE };
    const [auditStatusSubmitted] = await AuditStatus.update(
      { status: POLYGON_PENDING_APPROVAL },
      { where: { status: LEGACY_SUBMITTED, ...sitePolygonAuditWhere }, transaction, ...UPDATE_OPTIONS }
    );
    const [auditStatusInformationRequired] = await AuditStatus.update(
      { status: POLYGON_INFORMATION_REQUIRED },
      { where: { status: LEGACY_NEEDS_MORE_INFORMATION, ...sitePolygonAuditWhere }, transaction, ...UPDATE_OPTIONS }
    );

    return {
      sitePolygonSubmitted,
      sitePolygonInformationRequired,
      auditStatusSubmitted,
      auditStatusInformationRequired
    };
  });

  console.log("renameSitePolygonStatuses complete (active + soft-deleted rows)");
  console.table(summary);
  return summary;
});
