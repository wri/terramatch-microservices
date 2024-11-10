import { SitePolygonsService } from "./site-polygons.service";
import { Test, TestingModule } from "@nestjs/testing";
import {
  IndicatorOutputFieldMonitoringFactory,
  IndicatorOutputHectaresFactory,
  IndicatorOutputMsuCarbonFactory,
  IndicatorOutputTreeCountFactory,
  IndicatorOutputTreeCoverFactory,
  IndicatorOutputTreeCoverLossFactory,
  SitePolygonFactory,
  SiteReportFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { Indicator, PolygonGeometry, SitePolygon, TreeSpecies } from "@terramatch-microservices/database/entities";
import { BadRequestException } from "@nestjs/common";

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

  it("should return all indicators", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    await IndicatorOutputFieldMonitoringFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputHectaresFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCountFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: sitePolygon.id });
    await IndicatorOutputTreeCoverLossFactory.create({ sitePolygonId: sitePolygon.id });

    const indicators = await sitePolygon.getIndicators();
    const indicatorsDto = await service.getIndicators(sitePolygon);
    expect(indicators.length).toBe(indicatorsDto.length);

    const findDto = ({ yearOfAnalysis, indicatorSlug }: Indicator) =>
      indicatorsDto.find(dto => dto.yearOfAnalysis === yearOfAnalysis && dto.indicatorSlug === indicatorSlug);
    for (const indicator of indicators) {
      const dto = findDto(indicator);
      expect(dto).not.toBeNull();
      expect(indicator).toMatchObject(dto);
    }
  });

  it("should return all establishment tree species", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const site = await sitePolygon.loadSite();
    await TreeSpeciesFactory.forSite.createMany(3, { speciesableId: site.id });

    const treeSpecies = await site.loadTreeSpecies();
    const treeSpeciesDto = await service.getEstablishmentTreeSpecies(sitePolygon);
    expect(treeSpeciesDto.length).toBe(treeSpecies.length);

    const findDto = ({ name }: TreeSpecies) => treeSpeciesDto.find(dto => dto.name === name);
    for (const tree of treeSpecies) {
      const dto = findDto(tree);
      expect(dto).not.toBeNull();
      expect(tree).toMatchObject(dto);
    }
  });

  it("should return all reporting periods", async () => {
    const sitePolygon = await SitePolygonFactory.create();
    const site = await sitePolygon.loadSite();
    await SiteReportFactory.createMany(2, { siteId: site.id });
    const siteReports = await site.loadSiteReports();
    await TreeSpeciesFactory.forSiteReport.createMany(3, { speciesableId: siteReports[0].id });
    await TreeSpeciesFactory.forSiteReport.createMany(5, { speciesableId: siteReports[1].id });

    await siteReports[0].loadTreeSpecies();
    await siteReports[1].loadTreeSpecies();
    const reportingPeriodsDto = await service.getReportingPeriods(sitePolygon);
    expect(reportingPeriodsDto.length).toBe(siteReports.length);
    expect(siteReports[0]).toMatchObject(reportingPeriodsDto[0]);
    expect(siteReports[1]).toMatchObject(reportingPeriodsDto[1]);
  });

  it("should return all polygons when there are fewer than the page size", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const query = await service.buildQuery(20);
    const result = await query.execute();
    expect(result.length).toBe(15);
  });

  it("should return page size when there are more than the page size", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const query = await service.buildQuery(10);
    const result = await query.execute();
    expect(result.length).toBe(10);
  });

  it("Should return only the entries after the given entry when pageAfter is provided", async () => {
    await SitePolygon.truncate();
    await PolygonGeometry.truncate();
    await SitePolygonFactory.createMany(15);
    const first = await SitePolygon.findOne();
    const query = await service.buildQuery(20, first.uuid);
    const result = await query.execute();
    expect(result.length).toBe(14);
  });

  it("Should throw when pageAfter polygon not found", () => {
    expect(service.buildQuery(20, "asdfasdf")).rejects.toThrow(BadRequestException);
  });

  it("Should return empty arrays from utility methods if no associated records exist", async () => {
    const sitePolygon = await SitePolygonFactory.create({ siteUuid: null });
    expect(await service.getEstablishmentTreeSpecies(sitePolygon)).toEqual([]);
    expect(await service.getReportingPeriods(sitePolygon)).toEqual([]);
  });
});
