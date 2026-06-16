import { Test, TestingModule } from "@nestjs/testing";
import { IndicatorAuditService } from "./indicator-audit.service";
import { IndicatorExecutionContext } from "@terramatch-microservices/data-api";
import { AuditStatus } from "@terramatch-microservices/database/entities";
import { SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { INDICATOR_EXECUTION_AUDIT_TYPE } from "@terramatch-microservices/database/constants/audit-status";

describe("IndicatorAuditService", () => {
  let service: IndicatorAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndicatorAuditService]
    }).compile();

    service = module.get(IndicatorAuditService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should persist indicator execution details in audit status comment", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const context = new IndicatorExecutionContext("user-api", 99, 12);
    context.recordRequest({
      url: "https://data-api.example/dataset/test/latest/query",
      method: "POST",
      statusCode: 200,
      statusText: "OK",
      durationMs: 42,
      requestSummary: { dataset: "test", sql: "SELECT 1" },
      responseBody: { data: [] }
    });

    const auditStatus = await service.recordFromContext(context, {
      indicatorSlug: "treeCoverLoss",
      sitePolygonId: sitePolygon.id,
      outcome: "success",
      resultValue: { "2020": 1.2 }
    });

    expect(auditStatus).not.toBeNull();
    expect(auditStatus?.type).toBe(INDICATOR_EXECUTION_AUDIT_TYPE);
    expect(auditStatus?.auditableId).toBe(sitePolygon.id);

    const comment = JSON.parse(auditStatus?.comment ?? "{}");
    expect(comment).toMatchObject({
      indicatorSlug: "treeCoverLoss",
      sitePolygonUuid: sitePolygon.uuid,
      triggerSource: "user-api",
      triggeredByUserId: 99,
      delayedJobId: 12,
      outcome: "success",
      resultValue: { "2020": 1.2 }
    });
    expect(comment.externalRequests).toHaveLength(1);
    expect(comment.externalRequests[0].statusCode).toBe(200);

    const stored = await AuditStatus.findByPk(auditStatus?.id);
    expect(stored?.comment).toBe(auditStatus?.comment);
  });
});
