import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import {
  CriteriaSite,
  Disturbance,
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import {
  DisturbanceFactory,
  DisturbanceReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
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
    await Disturbance.truncate();
  });

  describe("scope validation", () => {
    it("rejects a request with no scope", async () => {
      await expect(getSummary({})).rejects.toThrow(BadRequestException);
    });

    it("rejects indicator aggregates without siteId[] or projectId[]", async () => {
      await expect(getSummary({ frameworkKey: ["ppc"], indicatorSlug: ["treeCoverLoss"] })).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects deletedOnly without siteId[] or projectId[]", async () => {
      await expect(getSummary({ frameworkKey: ["ppc"], deletedOnly: true })).rejects.toThrow(BadRequestException);
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
      expect(result.minCalcArea).toBe(1.5);
      expect(result.maxCalcArea).toBe(2.25);
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

    it("returns null min / max calcArea when no polygon in scope has one", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({ siteUuid: site.uuid, calcArea: null });

      const result = await getSummary({ siteId: [site.uuid] });

      expect(result.minCalcArea).toBeNull();
      expect(result.maxCalcArea).toBeNull();
    });

    it("applies calcArea range filter to aggregates", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 1, calcArea: 0.3 });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 10, calcArea: 5 });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 20, calcArea: 20 });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 100, calcArea: 38 });

      const result = await getSummary({ siteId: [site.uuid], calcAreaMin: 5, calcAreaMax: 20 });

      expect(result.totalPolygons).toBe(2);
      expect(result.sumNumTrees).toBe(30);
      expect(result.sumCalcArea).toBe(25);
      expect(result.minCalcArea).toBe(5);
      expect(result.maxCalcArea).toBe(20);
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

    it("aggregates across a project context scope without a project or site, hiding test projects", async () => {
      const organisation = await OrganisationFactory.create();
      const [project, otherCountry, testProject] = await Promise.all([
        ProjectFactory.create({ frameworkKey: "ppc", level0Project: ["KE"], organisationId: organisation.id }),
        ProjectFactory.create({ frameworkKey: "ppc", level0Project: ["GH"], organisationId: organisation.id }),
        ProjectFactory.create({
          frameworkKey: "ppc",
          level0Project: ["KE"],
          organisationId: organisation.id,
          isTest: true
        })
      ]);
      await Promise.all(
        [project, otherCountry, testProject].map(({ id }) =>
          ProjectReportFactory.create({ projectId: id, status: "approved", plantingStatus: "in-progress" })
        )
      );
      const [site, otherCountrySite, testSite] = await Promise.all(
        [project, otherCountry, testProject].map(({ id }) => SiteFactory.create({ projectId: id }))
      );
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 3, calcArea: 1 });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 7, calcArea: 2 });
      await SitePolygonFactory.create({ siteUuid: otherCountrySite.uuid, numTrees: 100, calcArea: 100 });
      await SitePolygonFactory.create({ siteUuid: testSite.uuid, numTrees: 100, calcArea: 100 });

      const result = await getSummary({
        frameworkKey: ["ppc"],
        country: ["KE"],
        organisationUuid: [organisation.uuid],
        plantingStatus: "in-progress"
      });

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

    it("respects hasDisturbance filter", async () => {
      const site = await SiteFactory.create();
      const report = await DisturbanceReportFactory.create();
      const disturbance = await DisturbanceFactory.disturbanceReport(report).create();
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        disturbanceId: disturbance.id,
        numTrees: 1,
        calcArea: 1
      });
      await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: 9, calcArea: 9, disturbanceId: null });

      const result = await getSummary({ siteId: [site.uuid], hasDisturbance: true });

      expect(result.totalPolygons).toBe(1);
      expect(result.sumNumTrees).toBe(1);
    });
  });

  describe("facet counts", () => {
    it("omits facetCounts unless facet[] is requested", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({ siteUuid: site.uuid });

      const result = await getSummary({ siteId: [site.uuid] });

      expect(result.facetCounts).toBeUndefined();
    });

    it("counts every option of each requested facet, including zeros", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "approved",
        validationStatus: "passed",
        practice: ["tree-planting", "direct-seeding"],
        targetSys: "agroforest",
        submissionCycle: "1"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "draft",
        validationStatus: null,
        practice: ["tree-planting"],
        targetSys: "agroforest",
        submissionCycle: "2"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "draft",
        validationStatus: "failed",
        practice: null,
        targetSys: null,
        submissionCycle: null
      });

      const { facetCounts } = await getSummary({
        siteId: [site.uuid],
        facet: ["polygonStatus", "practice", "submissionCycle", "targetSys", "validationStatus"]
      });

      expect(facetCounts?.polygonStatus).toEqual({
        draft: 2,
        "pending-approval": 0,
        "information-required": 0,
        approved: 1
      });
      expect(facetCounts?.validationStatus).toEqual({ not_checked: 1, passed: 1, partial: 0, failed: 1 });
      expect(facetCounts?.practice).toEqual({
        "tree-planting": 2,
        "direct-seeding": 1,
        "assisted-natural-regeneration": 0
      });
      expect(facetCounts?.targetSys?.agroforest).toBe(2);
      expect(facetCounts?.targetSys?.grassland).toBe(0);
      expect(facetCounts?.submissionCycle).toEqual({ "1": 1, "2": 1, "3": 0, "4": 0, "5": 0 });
    });

    it("ignores a facet's own filter but applies the others", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved", practice: ["tree-planting"] });
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved", practice: ["direct-seeding"] });
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft", practice: ["direct-seeding"] });

      const result = await getSummary({
        siteId: [site.uuid],
        polygonStatus: ["approved"],
        practice: ["tree-planting"],
        facet: ["polygonStatus", "practice"]
      });

      // Practice counts ignore practice[] but respect polygonStatus[], so direct seeding stays selectable.
      expect(result.facetCounts?.practice).toEqual({
        "tree-planting": 1,
        "direct-seeding": 1,
        "assisted-natural-regeneration": 0
      });
      // Status counts ignore polygonStatus[] but respect practice[].
      expect(result.facetCounts?.polygonStatus?.approved).toBe(1);
      expect(result.facetCounts?.polygonStatus?.draft).toBe(0);
      // The base aggregates still apply every filter.
      expect(result.totalPolygons).toBe(1);
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
