import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import {
  CriteriaSite,
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { ProjectFactory, SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import { SitePolygonSummaryService } from "./site-polygon-summary.service";
import { SitePolygonSummaryQueryDto } from "./dto/site-polygon-summary-query.dto";
import { TreeCoverLossSummaryDto, HectaresIndicatorSummaryDto } from "./dto/site-polygon-summary.dto";

describe("SitePolygonSummaryService", () => {
  let service: SitePolygonSummaryService;

  const getSummary = (query: Partial<SitePolygonSummaryQueryDto>) =>
    service.getSummary(query as SitePolygonSummaryQueryDto);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonSummaryService]
    }).compile();

    service = module.get(SitePolygonSummaryService);
  });

  afterEach(async () => {
    await CriteriaSite.truncate();
    await IndicatorOutputTreeCoverLoss.truncate();
    await IndicatorOutputHectares.truncate();
    await SitePolygon.truncate();
  });

  describe("scope validation", () => {
    it("rejects a request with no scope", async () => {
      await expect(getSummary({})).rejects.toThrow(BadRequestException);
    });

    it("rejects a request with both siteId[] and projectId[]", async () => {
      await expect(getSummary({ siteId: ["site-uuid"], projectId: ["project-uuid"] })).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects deletedOnly without exactly one siteId[]", async () => {
      await expect(getSummary({ projectId: ["project-uuid"], deletedOnly: true })).rejects.toThrow(BadRequestException);
    });

    it("rejects using missingIndicator[] and presentIndicator[] together", async () => {
      await expect(
        getSummary({ siteId: ["site-uuid"], missingIndicator: ["treeCover"], presentIndicator: ["treeCover"] })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("base aggregates", () => {
    it("sums trees, area, total, and status counts for a site", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "approved",
        numTrees: 10,
        calcArea: 1.5
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "draft",
        numTrees: 5,
        calcArea: 2.25
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "approved",
        numTrees: null,
        calcArea: null
      });

      const result = await getSummary({ siteId: [site.uuid] });

      expect(result.sumNumTrees).toBe(15);
      expect(result.sumCalcArea).toBe(3.75);
      expect(result.totalPolygons).toBe(3);
      expect(result.countByStatus).toEqual({
        draft: 1,
        "pending-approval": 0,
        "information-required": 0,
        approved: 2
      });
      expect(result.indicators).toBeUndefined();
    });

    it("applies polygonStatus filter to aggregates", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "approved",
        numTrees: 100,
        calcArea: 10
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "draft",
        numTrees: 50,
        calcArea: 5
      });

      const result = await getSummary({ siteId: [site.uuid], polygonStatus: ["approved"] });

      expect(result.sumNumTrees).toBe(100);
      expect(result.sumCalcArea).toBe(10);
      expect(result.totalPolygons).toBe(1);
      expect(result.countByStatus.approved).toBe(1);
      expect(result.countByStatus.draft).toBe(0);
    });

    it("aggregates across a project scope", async () => {
      const project = await ProjectFactory.create();
      const siteA = await SiteFactory.create({ projectId: project.id });
      const siteB = await SiteFactory.create({ projectId: project.id });
      await SitePolygonFactory.create({ siteUuid: siteA.uuid, numTrees: 3, calcArea: 1 });
      await SitePolygonFactory.create({ siteUuid: siteB.uuid, numTrees: 7, calcArea: 2 });

      const result = await getSummary({ projectId: [project.uuid] });

      expect(result.sumNumTrees).toBe(10);
      expect(result.sumCalcArea).toBe(3);
      expect(result.totalPolygons).toBe(2);
    });

    it("respects hasOverlap filter", async () => {
      const site = await SiteFactory.create();
      const overlapping = await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 1, calcArea: 1 });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 9, calcArea: 9 });
      await CriteriaSite.create({
        polygonId: overlapping.polygonUuid,
        criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
        valid: false
      } as CriteriaSite);

      const result = await getSummary({ siteId: [site.uuid], hasOverlap: true });

      expect(result.totalPolygons).toBe(1);
      expect(result.sumNumTrees).toBe(1);
    });
  });

  describe("indicator aggregates", () => {
    it("aggregates treeCoverLoss year sums and loss counts", async () => {
      const site = await SiteFactory.create();
      const withLoss = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });
      const noLoss = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });

      await IndicatorOutputTreeCoverLoss.create({
        sitePolygonId: withLoss.id,
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2024,
        value: { "2010": 1.5, "2011": 0.5 }
      } as IndicatorOutputTreeCoverLoss);
      await IndicatorOutputTreeCoverLoss.create({
        sitePolygonId: noLoss.id,
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2024,
        value: { "2010": 0, "2011": 0 }
      } as IndicatorOutputTreeCoverLoss);

      const result = await getSummary({
        siteId: [site.uuid],
        polygonStatus: ["approved"],
        indicatorSlug: ["treeCoverLoss"]
      });

      const loss = result.indicators?.treeCoverLoss as TreeCoverLossSummaryDto;
      expect(loss.sumByYear).toEqual({ "2010": 1.5, "2011": 0.5 });
      expect(loss.polygonsWithLoss).toBe(1);
      expect(loss.polygonsNoLoss).toBe(1);
      expect(loss.polygonsWithIndicator).toBe(2);
      expect(loss.polygonsMissing).toBe(1);
    });

    it("aggregates restorationByStrategy buckets", async () => {
      const site = await SiteFactory.create();
      const polygonA = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });
      const polygonB = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });

      await IndicatorOutputHectares.create({
        sitePolygonId: polygonA.id,
        indicatorSlug: "restorationByStrategy",
        yearOfAnalysis: 2024,
        value: { "tree-planting": 2, "direct-seeding": 1 }
      } as IndicatorOutputHectares);
      await IndicatorOutputHectares.create({
        sitePolygonId: polygonB.id,
        indicatorSlug: "restorationByStrategy",
        yearOfAnalysis: 2024,
        value: { "tree-planting": 3 }
      } as IndicatorOutputHectares);

      const result = await getSummary({
        siteId: [site.uuid],
        polygonStatus: ["approved"],
        indicatorSlug: ["restorationByStrategy"]
      });

      const strategy = result.indicators?.restorationByStrategy as HectaresIndicatorSummaryDto;
      expect(strategy.sumByBucket).toEqual({
        "tree-planting": 5,
        "direct-seeding": 1
      });
      expect(strategy.polygonsWithIndicator).toBe(2);
      expect(strategy.polygonsMissing).toBe(1);
    });

    it("uses the latest yearOfAnalysis row per polygon", async () => {
      const site = await SiteFactory.create();
      const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });

      await IndicatorOutputTreeCoverLoss.create({
        sitePolygonId: polygon.id,
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2020,
        value: { "2010": 100 }
      } as IndicatorOutputTreeCoverLoss);
      await IndicatorOutputTreeCoverLoss.create({
        sitePolygonId: polygon.id,
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2024,
        value: { "2010": 2 }
      } as IndicatorOutputTreeCoverLoss);

      const result = await getSummary({
        siteId: [site.uuid],
        indicatorSlug: ["treeCoverLoss"]
      });

      const loss = result.indicators?.treeCoverLoss as TreeCoverLossSummaryDto;
      expect(loss.sumByYear).toEqual({ "2010": 2 });
    });
  });

  describe("getResourceId", () => {
    it("matches getStableRequestQuery", () => {
      const query = { siteId: ["b", "a"], indicatorSlug: ["treeCoverLoss"] } as SitePolygonSummaryQueryDto;
      expect(service.getResourceId(query)).toBe(getStableRequestQuery(query));
    });
  });
});
