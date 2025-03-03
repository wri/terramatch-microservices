import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import {
  DemographicEntryFactory,
  DemographicFactory,
  ProjectReportFactory,
  SeedingFactory,
  SiteReportFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { DemographicDto, DemographicEntryDto } from "../dto/demographic.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { TreeSpeciesDto } from "../dto/tree-species.dto";
import { SeedingDto } from "../dto/seeding.dto";

describe("AssociationProcessor", () => {
  let service: EntitiesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    service = module.get(EntitiesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addDtos", () => {
    it("should include demographic entries", async () => {
      const { uuid: projectReportUuid, id: demographicalId } = await ProjectReportFactory.create();
      const { id: demographicId, uuid } = await DemographicFactory.forProjectReportJobs.create({ demographicalId });
      const female = pickApiProperties(
        await DemographicEntryFactory.create({ demographicId, type: "gender", subtype: "female" }),
        DemographicEntryDto
      );
      const unknown = pickApiProperties(
        await DemographicEntryFactory.create({ demographicId, type: "gender", subtype: "unknown" }),
        DemographicEntryDto
      );
      const youth = pickApiProperties(
        await DemographicEntryFactory.create({ demographicId, type: "age", subtype: "youth" }),
        DemographicEntryDto
      );

      const document = buildJsonApi(DemographicDto, { forceDataArray: true });
      await service.createAssociationProcessor("projectReports", projectReportUuid, "demographics").addDtos(document);
      const data = document.serialize().data as Resource[];
      expect(data.length).toEqual(1);

      const dto = data.find(({ id }) => id === uuid)?.attributes as unknown as DemographicDto;
      expect(dto).not.toBeNull();
      expect(dto.entries.length).toBe(3);
      expect(dto.entries.find(({ type, subtype }) => type === "gender" && subtype === "female")).toMatchObject(female);
      expect(dto.entries.find(({ type, subtype }) => type === "gender" && subtype === "unknown")).toMatchObject(
        unknown
      );
      expect(dto.entries.find(({ type, subtype }) => type === "age" && subtype === "youth")).toMatchObject(youth);
    });

    it("should include tree species", async () => {
      const { id: speciesableId, uuid: siteReportUuid } = await SiteReportFactory.create();
      const species = await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(5, { speciesableId });
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId, hidden: true });

      const document = buildJsonApi(TreeSpeciesDto, { forceDataArray: true });
      await service.createAssociationProcessor("siteReports", siteReportUuid, "treeSpecies").addDtos(document);
      const data = document.serialize().data as Resource[];
      expect(data.length).toEqual(species.length);

      for (const { attributes } of data) {
        const treeData = attributes as unknown as TreeSpeciesDto;
        expect(treeData).not.toBeNull();

        const tree = species.find(({ uuid }) => uuid === treeData.uuid);
        expect(treeData).toMatchObject(pickApiProperties(tree, TreeSpeciesDto));
      }
    });

    it("should include seedings", async () => {
      const { id: seedableId, uuid: siteReportUuid } = await SiteReportFactory.create();
      const seedings = await SeedingFactory.forSiteReport.createMany(5, { seedableId });
      await SeedingFactory.forSiteReport.create({ seedableId, hidden: true });

      const document = buildJsonApi(SeedingDto, { forceDataArray: true });
      await service.createAssociationProcessor("siteReports", siteReportUuid, "seedings").addDtos(document);
      const data = document.serialize().data as Resource[];
      expect(data.length).toEqual(seedings.length);

      for (const { attributes } of data) {
        const seedingData = attributes as unknown as SeedingDto;
        expect(seedingData).not.toBeNull();

        const seeding = seedings.find(({ uuid }) => uuid === seedingData.uuid);
        expect(seedingData).toMatchObject(pickApiProperties(seeding, SeedingDto));
      }
    });
  });
});
