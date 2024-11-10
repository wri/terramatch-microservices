import { SitePolygonsService } from "./site-polygons.service";
import { Test, TestingModule } from "@nestjs/testing";
import {
  IndicatorOutputFieldMonitoringFactory,
  IndicatorOutputHectaresFactory,
  IndicatorOutputMsuCarbonFactory,
  IndicatorOutputTreeCountFactory,
  IndicatorOutputTreeCoverFactory,
  IndicatorOutputTreeCoverLossFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { Indicator, TreeSpecies } from "@terramatch-microservices/database/entities";
import { TreeSpeciesFactory } from "@terramatch-microservices/database/factories/tree-species.factory";

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
});
