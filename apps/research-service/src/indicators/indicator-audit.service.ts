import { Injectable } from "@nestjs/common";
import { IndicatorExecutionContext, type ExternalRequestLog } from "@terramatch-microservices/data-api";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { INDICATOR_EXECUTION_AUDIT_TYPE } from "@terramatch-microservices/database/constants/audit-status";
import { AuditStatus, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { INDICATOR_MODEL_CLASSES } from "../site-polygons/site-polygon-query.builder";
import { Transaction } from "sequelize";

export const INDICATOR_EXECUTION_TRIGGER_SOURCES = ["user-api", "manual-edit", "automated-job", "system"] as const;
export type IndicatorExecutionTriggerSource = (typeof INDICATOR_EXECUTION_TRIGGER_SOURCES)[number];

export const INDICATOR_EXECUTION_OUTCOMES = ["success", "no-data", "failed", "skipped"] as const;
export type IndicatorExecutionOutcome = (typeof INDICATOR_EXECUTION_OUTCOMES)[number];

export type IndicatorExecutionComment = {
  indicatorSlug: IndicatorSlug;
  polygonUuid: string | null;
  sitePolygonUuid: string;
  yearOfAnalysis: number | null;
  triggerSource: IndicatorExecutionTriggerSource;
  triggeredByUserId: number | null;
  delayedJobId: number | null;
  outcome: IndicatorExecutionOutcome;
  durationMs: number;
  errorMessage: string | null;
  resultValue: object | null;
  indicatorOutputId: number | null;
  indicatorOutputTable: string | null;
  externalRequests: ExternalRequestLog[] | null;
};

export type RecordIndicatorAuditParams = {
  indicatorSlug: IndicatorSlug;
  sitePolygonId: number;
  outcome: IndicatorExecutionOutcome;
  triggerSource: IndicatorExecutionTriggerSource;
  triggeredBy?: number | null;
  delayedJobId?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  resultValue?: object | null;
  externalRequests?: ExternalRequestLog[] | null;
  indicatorOutputId?: number | null;
  polygonUuid?: string | null;
  yearOfAnalysis?: number | null;
};

@Injectable()
export class IndicatorAuditService {
  createContext(
    triggerSource: IndicatorExecutionTriggerSource,
    triggeredBy?: number | null,
    delayedJobId?: number | null
  ) {
    return new IndicatorExecutionContext(triggerSource, triggeredBy ?? null, delayedJobId);
  }

  resolveTriggeredBy(explicitUserId?: number | null) {
    return explicitUserId ?? UserContext.authenticatedUserId ?? null;
  }

  buildComment(sitePolygon: SitePolygon, params: RecordIndicatorAuditParams): string {
    const indicatorClass = INDICATOR_MODEL_CLASSES[params.indicatorSlug];

    const payload: IndicatorExecutionComment = {
      indicatorSlug: params.indicatorSlug,
      polygonUuid: params.polygonUuid ?? sitePolygon.polygonUuid,
      sitePolygonUuid: sitePolygon.uuid,
      yearOfAnalysis: params.yearOfAnalysis ?? null,
      triggerSource: params.triggerSource,
      triggeredByUserId: params.triggeredBy ?? null,
      delayedJobId: params.delayedJobId ?? null,
      outcome: params.outcome,
      durationMs: params.durationMs ?? 0,
      errorMessage: params.errorMessage ?? null,
      resultValue: params.resultValue ?? null,
      indicatorOutputId: params.indicatorOutputId ?? null,
      indicatorOutputTable: indicatorClass?.tableName ?? null,
      externalRequests: params.externalRequests ?? null
    };

    return JSON.stringify(payload);
  }

  async record(params: RecordIndicatorAuditParams, transaction?: Transaction) {
    const sitePolygon = await SitePolygon.findByPk(params.sitePolygonId, {
      attributes: ["id", "status", "uuid", "polygonUuid"]
    });
    if (sitePolygon == null) return null;

    const triggeredBy = params.triggeredBy ?? null;
    const user =
      triggeredBy == null
        ? null
        : await User.findByPk(triggeredBy, {
            attributes: ["emailAddress", "firstName", "lastName"]
          });

    return await AuditStatus.create(
      {
        auditableType: SitePolygon.LARAVEL_TYPE,
        auditableId: sitePolygon.id,
        status: sitePolygon.status,
        comment: this.buildComment(sitePolygon, params),
        type: INDICATOR_EXECUTION_AUDIT_TYPE,
        createdBy: user?.emailAddress ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null
      },
      transaction != null ? { transaction } : undefined
    );
  }

  async recordFromContext(
    context: IndicatorExecutionContext,
    params: Omit<
      RecordIndicatorAuditParams,
      "triggerSource" | "triggeredBy" | "delayedJobId" | "durationMs" | "externalRequests"
    > &
      Partial<Pick<RecordIndicatorAuditParams, "triggerSource" | "triggeredBy" | "delayedJobId">>
  ) {
    return await this.record({
      ...params,
      triggerSource: params.triggerSource ?? context.triggerSource,
      triggeredBy: params.triggeredBy !== undefined ? params.triggeredBy : context.triggeredBy,
      delayedJobId: params.delayedJobId !== undefined ? params.delayedJobId : context.delayedJobId,
      durationMs: context.elapsedMs(),
      externalRequests: context.externalRequests.length > 0 ? context.externalRequests : null
    });
  }
}
