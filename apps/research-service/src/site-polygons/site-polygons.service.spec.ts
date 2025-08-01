/* eslint-disable @typescript-eslint/no-non-null-assertion,@typescript-eslint/no-non-null-asserted-optional-chain */
import FakeTimers from "@sinonjs/fake-timers";
import { SitePolygonsService } from "./site-polygons.service";
import { Test, TestingModule } from "@nestjs/testing";
import {
  IndicatorOutputFieldMonitoringFactory,
  IndicatorOutputHectaresFactory,
  IndicatorOutputMsuCarbonFactory,
  IndicatorOutputTreeCountFactory,
  IndicatorOutputTreeCoverFactory,
  IndicatorOutputTreeCoverLossFactory,
  LandscapeGeometryFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory,
  SiteReportFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import {
  Indicator,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { IndicatorHectaresDto, IndicatorTreeCountDto, IndicatorTreeCoverLossDto } from "./dto/indicators.dto";
import { IndicatorDto, SitePolygonFullDto, SitePolygonLightDto } from "./dto/site-polygon.dto";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";

describe("SitePolygonsService", () => {
  let service: SitePolygonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonsService]
    }).compile();

    service = module.get<SitePolygonsService>(SitePolygonsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw with invalid page parameters", async () => {
    await expect(service.buildQuery({ size: 3, number: 5, after: "asdf" })).rejects.toThrow(BadRequestException);
  });

  it("should respect a number page", async () => {
    const result = await service.buildQuery({ size: 3, number: 5 });
    expect((result as unknown as { findOptions: { offset: number } }).findOptions.offset).toBe(12);
  });

  it("should succeed when there are 0 polygons in the filtered request", async () => {
    const associations = await service.loadAssociationDtos([], false);
    expect(associations).toEqual({});
  });

  it("should return all indicators", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    await IndicatorOutputFieldMonitoringFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCountFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCoverLossFactory.create({ sitePolygonId: sitePolygon.id });

    const indicators = await sitePolygon.getIndicators();
    const associations = await service.loadAssociationDtos([sitePolygon], true);
    const indicatorDtos = associations[sitePolygon.id]?.indicators;
    expect(indicatorDtos?.length).toBe(indicators.length);

    const findDto = ({ yearOfAnalysis, indicatorSlug }: Indicator) =>
      indicatorDtos?.find(dto => dto.yearOfAnalysis === yearOfAnalysis && dto.indicatorSlug === indicatorSlug);
    for (const indicator of indicators) {
      const dto = findDto(indicator);
      expect(dto).not.toBeNull();
      expect(indicator).toMatchObject(dto!);
    }
  });

  it("should return all establishment tree species", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const site = (await sitePolygon.loadSite()) as Site;
    await TreeSpeciesFactory.forSiteTreePlanted.createMany(3, { speciesableId: site.id });

    const treeSpecies = await site.loadTreesPlanted();
    const associations = await service.loadAssociationDtos([sitePolygon], false);
    const treeSpeciesDtos = associations[sitePolygon.id]?.establishmentTreeSpecies;
    expect(treeSpeciesDtos?.length).toBe(treeSpecies.length);

    const findDto = ({ name }: TreeSpecies) => treeSpeciesDtos?.find(dto => dto.name === name);
    for (const tree of treeSpecies) {
      const dto = findDto(tree);
      expect(dto).not.toBeNull();
      expect(tree).toMatchObject(dto!);
    }
  });

  it("should return all reporting periods", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const site = (await sitePolygon.loadSite()) as Site;
    await SiteReportFactory.createMany(2, { siteId: site.id });
    const siteReports = await site.loadReports();
    await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(3, { speciesableId: siteReports[0].id });
    await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(5, { speciesableId: siteReports[1].id });

    await siteReports[0].loadTreesPlanted();
    await siteReports[1].loadTreesPlanted();
    const associations = await service.loadAssociationDtos([sitePolygon], false);
    const reportingPeriodsDtos = associations[sitePolygon.id]?.reportingPeriods;
    expect(reportingPeriodsDtos?.length).toBe(siteReports.length);
    expect({
      dueAt: siteReports[0].dueAt,
      submittedAt: siteReports[0].submittedAt,
      treeSpecies: siteReports[0].treesPlanted
    }).toMatchObject(reportingPeriodsDtos?.[0]!);
    expect({
      dueAt: siteReports[1].dueAt,
      submittedAt: siteReports[1].submittedAt,
      treeSpecies: siteReports[1].treesPlanted
    }).toMatchObject(reportingPeriodsDtos?.[1]!);
  });

  it("should return all polygons when there are fewer than the page size", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const query = await service.buildQuery({ size: 20 });
    const result = await query.execute();
    expect(result.length).toBe(15);
  });

  it("should return page size when there are more than the page size", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const query = await service.buildQuery({ size: 10 });
    const result = await query.execute();
    expect(result.length).toBe(10);
  });

  it("Should return only the entries after the given entry when pageAfter is provided", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const first = await SitePolygon.findOne();
    const query = await service.buildQuery({ size: 20, after: first!.uuid });
    const result = await query.execute();
    expect(result.length).toBe(14);
  });

  it("Should throw when pageAfter polygon not found", async () => {
    await expect(service.buildQuery({ size: 20, after: "asdfasdf" })).rejects.toThrow(BadRequestException);
  });

  it("Should filter out test projects", async () => {
    await SitePolygon.truncate();
    const project1 = await ProjectFactory.create({ isTest: true });
    const site1 = await SiteFactory.create({ projectId: project1.id });
    const project2 = await ProjectFactory.create();
    const site2 = await SiteFactory.create({ projectId: project2.id });
    const poly1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
    const poly2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });

    let query = await service.buildQuery({ size: 20 });
    await query.excludeTestProjects();
    let result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly2.id);

    query = await service.buildQuery({ size: 20 });
    result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id].sort());
  });
  it("Should only include polygons belonging to the given siteId", async () => {
    await SitePolygon.truncate();

    const site1 = await SiteFactory.create();
    const site2 = await SiteFactory.create();

    const poly1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
    const poly2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });

    const queryWithSite1 = {
      page: { size: 20 },
      siteId: [site1.uuid]
    };

    const queryWithSite2 = {
      page: { size: 20 },
      siteId: [site2.uuid]
    };

    const queryBuilder1 = await service.buildQuery({ size: queryWithSite1.page.size });
    await queryBuilder1.filterSiteUuids(queryWithSite1.siteId);
    const result1 = await queryBuilder1.execute();

    expect(result1.length).toBe(1);
    expect(result1[0].id).toBe(poly1.id);

    const queryBuilder2 = await service.buildQuery({ size: queryWithSite2.page.size });
    await queryBuilder2.filterSiteUuids(queryWithSite2.siteId);
    const result2 = await queryBuilder2.execute();

    expect(result2.length).toBe(1);
    expect(result2[0].id).toBe(poly2.id);
  });

  it("Should only include given projects", async () => {
    await SitePolygon.truncate();
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const poly1 = await SitePolygonFactory.create({ siteUuid: site.uuid });
    const poly2 = await SitePolygonFactory.create();

    let query = await service.buildQuery({ size: 20 });
    await query.filterProjectUuids([project.uuid]);
    let result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly1.id);

    query = await service.buildQuery({ size: 20 });
    result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id].sort());
  });

  it("should only include projects in the cohort given", async () => {
    await SitePolygon.truncate();
    await Project.truncate();
    const tf = await ProjectFactory.create({ cohort: ["terrafund"] });
    const ppc = await ProjectFactory.create({ cohort: ["ppc"] });
    const tfSite = await SiteFactory.create({ projectId: tf.id });
    const ppcSite = await SiteFactory.create({ projectId: ppc.id });
    const tfPoly = await SitePolygonFactory.create({ siteUuid: tfSite.uuid });
    const ppcPoly = await SitePolygonFactory.create({ siteUuid: ppcSite.uuid });

    let query = await (await service.buildQuery({ size: 20 })).filterProjectAttributes(["terrafund"]);
    let result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(tfPoly.id);

    query = await (await service.buildQuery({ size: 20 })).filterProjectAttributes(["ppc"]);
    result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(ppcPoly.id);
  });

  it("should only include projects in the landscape given", async () => {
    const landscapes = await LandscapeGeometryFactory.createMany(2);
    const inLandscape1 = await ProjectFactory.createMany(2, { landscape: landscapes[0].landscape });
    const inLandscape2 = await ProjectFactory.createMany(2, { landscape: landscapes[1].landscape });
    const noLandscape = await ProjectFactory.createMany(2, { landscape: null });

    const landscape1Sites = await Promise.all(inLandscape1.map(({ id }) => SiteFactory.create({ projectId: id })));
    const landscape2Sites = await Promise.all(inLandscape2.map(({ id }) => SiteFactory.create({ projectId: id })));
    const noLandscapeSites = await Promise.all(noLandscape.map(({ id }) => SiteFactory.create({ projectId: id })));

    const landscape1Polys = await Promise.all(
      landscape1Sites.map(({ uuid }) => SitePolygonFactory.create({ siteUuid: uuid }))
    );
    const landscape2Polys = await Promise.all(
      landscape2Sites.map(({ uuid }) => SitePolygonFactory.create({ siteUuid: uuid }))
    );
    await Promise.all(noLandscapeSites.map(({ uuid }) => SitePolygonFactory.create({ siteUuid: uuid })));

    let query = await (
      await service.buildQuery({ size: 20 })
    ).filterProjectAttributes(undefined, landscapes[0].slug as LandscapeSlug);
    let result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual(landscape1Polys.map(({ id }) => id).sort());

    query = await (
      await service.buildQuery({ size: 20 })
    ).filterProjectAttributes(undefined, landscapes[1].slug as LandscapeSlug);
    result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual(landscape2Polys.map(({ id }) => id).sort());
  });

  it("should filter based on landscape and cohort", async () => {
    const landscapes = await LandscapeGeometryFactory.createMany(2);
    const inLandscape1 = await Promise.all([
      ProjectFactory.create({ landscape: landscapes[0].landscape, cohort: ["ppc"] }),
      ProjectFactory.create({ landscape: landscapes[0].landscape, cohort: ["terrafund"] })
    ]);
    const inLandscape2 = await Promise.all([
      ProjectFactory.create({ landscape: landscapes[1].landscape, cohort: ["ppc"] }),
      ProjectFactory.create({ landscape: landscapes[1].landscape, cohort: ["terrafund"] })
    ]);

    const landscape1Sites = await Promise.all(inLandscape1.map(({ id }) => SiteFactory.create({ projectId: id })));
    const landscape2Sites = await Promise.all(inLandscape2.map(({ id }) => SiteFactory.create({ projectId: id })));

    const landscape1Polys = await Promise.all(
      landscape1Sites.map(({ uuid }) => SitePolygonFactory.create({ siteUuid: uuid }))
    );
    const landscape2Polys = await Promise.all(
      landscape2Sites.map(({ uuid }) => SitePolygonFactory.create({ siteUuid: uuid }))
    );

    const cases = [
      { polyId: landscape1Polys[0].id, cohort: ["ppc"], landscape: landscapes[0].slug as LandscapeSlug },
      { polyId: landscape1Polys[1].id, cohort: ["terrafund"], landscape: landscapes[0].slug as LandscapeSlug },
      { polyId: landscape2Polys[0].id, cohort: ["ppc"], landscape: landscapes[1].slug as LandscapeSlug },
      { polyId: landscape2Polys[1].id, cohort: ["terrafund"], landscape: landscapes[1].slug as LandscapeSlug }
    ];
    for (const { polyId, cohort, landscape } of cases) {
      const query = await (await service.buildQuery({ size: 20 })).filterProjectAttributes(cohort, landscape);
      const result = await query.execute();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(polyId);
    }
  });

  it("should only include polys with the given statuses", async () => {
    await SitePolygon.truncate();
    const draftPoly = await SitePolygonFactory.create({ status: "draft" });
    const submittedPoly = await SitePolygonFactory.create({ status: "submitted" });
    const approvedPoly = await SitePolygonFactory.create({ status: "approved" });

    let query = (await service.buildQuery({ size: 20 })).hasStatuses(["draft"]);
    let result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(draftPoly.id);

    query = (await service.buildQuery({ size: 20 })).hasStatuses(["draft", "approved"]);
    result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual([draftPoly.id, approvedPoly.id].sort());

    query = await service.buildQuery({ size: 20 });
    result = await query.execute();
    expect(result.length).toBe(3);
    expect(result.map(({ id }) => id).sort()).toEqual([draftPoly.id, submittedPoly.id, approvedPoly.id].sort());
  });

  it("should only return polys updated since the given date", async () => {
    // sequelize doesn't support manually setting createdAt or updatedAt, so we have to mess with the
    // system clock for this test.
    const clock = FakeTimers.install({ shouldAdvanceTime: true });
    try {
      await SitePolygon.truncate();
      const oldDate = faker.date.past({ years: 1 });
      const newDate = faker.date.recent();
      clock.setSystemTime(oldDate);
      const poly1 = await SitePolygonFactory.create({ status: "draft" });
      clock.setSystemTime(newDate);
      const poly2 = await SitePolygonFactory.create();

      let query = (await service.buildQuery({ size: 20 })).modifiedSince(
        DateTime.fromJSDate(oldDate).plus({ days: 5 }).toJSDate()
      );
      let result = await query.execute();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(poly2.id);

      const updateDate = DateTime.fromJSDate(newDate).plus({ days: 1 }).toJSDate();
      clock.setSystemTime(updateDate);
      await poly1.update({ status: "submitted" });
      // The SQL query uses greater than or equal, but in order to get around weirdness with
      // truncated date precision, we test with a slightly older date time.
      query = (await service.buildQuery({ size: 20 })).modifiedSince(
        DateTime.fromJSDate(updateDate).minus({ minutes: 1 }).toJSDate()
      );
      result = await query.execute();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(poly1.id);

      query = await service.buildQuery({ size: 20 });
      result = await query.execute();
      expect(result.length).toBe(2);
      expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id].sort());
    } finally {
      clock.uninstall();
    }
  });

  it("should only return polys missing the given indicators", async () => {
    await SitePolygon.truncate();
    const poly1 = await SitePolygonFactory.create();
    await IndicatorOutputFieldMonitoringFactory.create({ sitePolygonId: poly1.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly1.id, indicatorSlug: "restorationByLandUse" });
    const poly2 = await SitePolygonFactory.create();
    await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: poly2.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly2.id, indicatorSlug: "restorationByLandUse" });
    const poly3 = await SitePolygonFactory.create();
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly3.id, indicatorSlug: "restorationByStrategy" });

    let query = (await service.buildQuery({ size: 20 })).isMissingIndicators(["fieldMonitoring"]);
    let result = await query.execute();
    expect(result.length).toBe(2);
    expect(result.map(({ id }) => id).sort()).toEqual([poly2.id, poly3.id].sort());

    query = (await service.buildQuery({ size: 20 })).isMissingIndicators(["restorationByLandUse"]);
    result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly3.id);

    query = (await service.buildQuery({ size: 20 })).isMissingIndicators(["restorationByStrategy", "msuCarbon"]);
    result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly1.id);

    query = (await service.buildQuery({ size: 20 })).isMissingIndicators(["restorationByEcoRegion"]);
    result = await query.execute();
    expect(result.length).toBe(3);
    expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id, poly3.id].sort());

    query = await service.buildQuery({ size: 20 });
    result = await query.execute();
    expect(result.length).toBe(3);
    expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id, poly3.id].sort());
  });

  it("should only return polys with all specified indicators present", async () => {
    await SitePolygon.truncate();
    const poly1 = await SitePolygonFactory.create();
    await IndicatorOutputFieldMonitoringFactory.create({ sitePolygonId: poly1.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly1.id, indicatorSlug: "restorationByStrategy" });

    const poly2 = await SitePolygonFactory.create();
    await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: poly2.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly2.id, indicatorSlug: "restorationByLandUse" });

    const poly3 = await SitePolygonFactory.create();
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: poly3.id, indicatorSlug: "treeCover" });

    let query = (await service.buildQuery({ size: 20 })).hasPresentIndicators(["restorationByStrategy"]);
    let result = await query.execute();

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly1.id);

    query = (await service.buildQuery({ size: 20 })).hasPresentIndicators(["msuCarbon", "restorationByLandUse"]);
    result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(poly2.id);

    query = (await service.buildQuery({ size: 20 })).hasPresentIndicators(["restorationByEcoRegion"]);
    result = await query.execute();
    expect(result.length).toBe(0);

    query = await service.buildQuery({ size: 20 });
    result = await query.execute();
    expect(result.length).toBe(3);
    expect(result.map(({ id }) => id).sort()).toEqual([poly1.id, poly2.id, poly3.id].sort());
  });

  it("throws when an indicator slug is invalid", async () => {
    const query = await service.buildQuery({ size: 20 });
    expect(() => query.isMissingIndicators(["foo" as IndicatorSlug])).toThrow(BadRequestException);
    expect(() => query.hasPresentIndicators(["foo" as IndicatorSlug])).toThrow(BadRequestException);
  });

  it("Can apply multiple filter types at once", async () => {
    await SitePolygon.truncate();
    const project1 = await ProjectFactory.create({ isTest: true });
    const site1 = await SiteFactory.create({ projectId: project1.id });
    const project2 = await ProjectFactory.create();
    const site2 = await SiteFactory.create({ projectId: project2.id });
    const draftPoly1 = await SitePolygonFactory.create({ siteUuid: site1.uuid, status: "draft" });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: draftPoly1.id,
      indicatorSlug: "restorationByStrategy"
    });
    const draftPoly2 = await SitePolygonFactory.create({ siteUuid: site2.uuid, status: "draft" });
    await SitePolygonFactory.create({ siteUuid: site1.uuid, status: "approved" });
    const approvedPoly2 = await SitePolygonFactory.create({ siteUuid: site2.uuid, status: "approved" });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: approvedPoly2.id,
      indicatorSlug: "restorationByStrategy"
    });

    const query = (await service.buildQuery({ size: 20 }))
      .isMissingIndicators(["restorationByStrategy"])
      .hasStatuses(["draft", "approved"]);
    await query.filterProjectUuids([project2.uuid]);
    const result = await query.execute();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(draftPoly2.id);
  });

  it("should commit a transaction", async () => {
    const commit = jest.fn();
    // @ts-expect-error incomplete mock.
    jest.spyOn(SitePolygon.sequelize, "transaction").mockResolvedValue({ commit });

    const result = await service.transaction(async () => "result");
    expect(result).toBe("result");
    expect(commit).toHaveBeenCalled();
  });

  it("should roll back a transaction", async () => {
    const rollback = jest.fn();
    // @ts-expect-error incomplete mock
    jest.spyOn(SitePolygon.sequelize, "transaction").mockResolvedValue({ rollback });

    await expect(
      service.transaction(async () => {
        throw new Error("Test Exception");
      })
    ).rejects.toThrow("Test Exception");
    expect(rollback).toHaveBeenCalled();
  });

  it("should throw if the site polygon is not found", async () => {
    await expect(service.updateIndicator("asdfasdf", {} as IndicatorDto)).rejects.toThrow(NotFoundException);
  });

  it("should throw if the indicator slug is invalid", async () => {
    const { uuid } = await SitePolygonFactory.create();
    // @ts-expect-error incomplete DTO object
    await expect(service.updateIndicator(uuid, { indicatorSlug: "foobar" as IndicatorSlug })).rejects.toThrow(
      BadRequestException
    );
  });

  it("should create a new indicator row if none exists", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const dto = {
      indicatorSlug: "treeCoverLoss",
      yearOfAnalysis: 2025,
      value: {
        "2023": 0.45,
        "2024": 0.6,
        "2025": 0.8
      }
    } as IndicatorTreeCoverLossDto;
    await service.updateIndicator(sitePolygon.uuid, dto);
    const treeCoverLoss = await sitePolygon.$get("indicatorsTreeCoverLoss");
    expect(treeCoverLoss.length).toBe(1);
    expect(treeCoverLoss[0]).toMatchObject(dto);
  });

  it("should create a new indicator row if the yearOfAnalysis does not match", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const dto = {
      indicatorSlug: "restorationByLandUse",
      yearOfAnalysis: 2025,
      value: {
        "Northern Acacia-Commiphora bushlands and thickets": 0.114
      }
    } as IndicatorHectaresDto;
    await IndicatorOutputHectaresFactory.create({
      ...dto,
      yearOfAnalysis: 2024,
      sitePolygonId: sitePolygon.id
    });
    await service.updateIndicator(sitePolygon.uuid, dto);
    const hectares = await sitePolygon.$get("indicatorsHectares");
    expect(hectares.length).toBe(2);
    expect(hectares[0]).toMatchObject({ ...dto, yearOfAnalysis: 2024 });
    expect(hectares[1]).toMatchObject(dto);
  });

  it("should update an indicator if it already exists", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const dto = {
      indicatorSlug: "treeCount",
      yearOfAnalysis: 2024,
      surveyType: "string",
      surveyId: 1000,
      treeCount: 5432,
      uncertaintyType: "types TBD",
      imagerySource: "maxar",
      imageryId: "https://foo.bar/image",
      projectPhase: "establishment",
      confidence: 70
    } as IndicatorTreeCountDto;
    await IndicatorOutputTreeCountFactory.create({
      ...dto,
      sitePolygonId: sitePolygon.id,
      confidence: 20
    });
    await service.updateIndicator(sitePolygon.uuid, dto);
    const treeCount = await sitePolygon.$get("indicatorsTreeCount");
    expect(treeCount.length).toBe(1);
    expect(treeCount[0]).toMatchObject(dto);
  });

  it("should build LightDto correctly when lightResource is true", async () => {
    await SitePolygon.truncate();
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft" });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: sitePolygon.id,
      indicatorSlug: "restorationByStrategy"
    });

    const associations = await service.loadAssociationDtos([sitePolygon], true);
    const lightDto = await service.buildLightDto(sitePolygon, associations[sitePolygon.id]);

    expect(lightDto).toBeInstanceOf(SitePolygonLightDto);
    expect(lightDto.name).toBe(sitePolygon.polyName);
  });

  it("should build FullDto correctly when lightResource is false", async () => {
    await SitePolygon.truncate();
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft" });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: sitePolygon.id,
      indicatorSlug: "restorationByStrategy"
    });

    const associations = await service.loadAssociationDtos([sitePolygon], false);
    const fullDto = await service.buildFullDto(sitePolygon, associations[sitePolygon.id]);

    expect(fullDto).toBeInstanceOf(SitePolygonFullDto);
    expect(fullDto.name).toBe(sitePolygon.polyName);
  });

  it("should add search filters for site name and polygon name when search is provided in query parameters", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();

    const project = await ProjectFactory.create();
    const site1 = await SiteFactory.create({
      projectId: project.id,
      name: "Alpha Site"
    });
    const site2 = await SiteFactory.create({
      projectId: project.id,
      name: "Beta Location"
    });
    const site3 = await SiteFactory.create({
      projectId: project.id,
      name: "Gamma Zone"
    });

    await SitePolygonFactory.create({
      siteUuid: site1.uuid,
      polyName: "First Polygon"
    });
    await SitePolygonFactory.create({
      siteUuid: site2.uuid,
      polyName: "Alphabetical Order"
    });
    await SitePolygonFactory.create({
      siteUuid: site3.uuid,
      polyName: "Zone Polygon"
    });

    let query = await service.buildQuery({ size: 10 });
    await query.addSearch("Alpha");
    let results = await query.execute();
    expect(results.length).toBe(2);
    expect(results[0].siteUuid).toBe(site1.uuid);

    query = await service.buildQuery({ size: 10 });
    await query.addSearch("Zone");
    results = await query.execute();
    expect(results.length).toBe(1);
    expect(results[0].siteUuid).toBe(site3.uuid);
    expect(results[0].polyName).toBe("Zone Polygon");
  });
});
