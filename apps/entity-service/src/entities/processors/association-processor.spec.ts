/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
import { PolicyService } from "@terramatch-microservices/common";
import { SiteReport } from "@terramatch-microservices/database/entities";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("AssociationProcessor", () => {
  let service: EntitiesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
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
      const result = document.serialize();
      const data = result.data as Resource[];
      expect(data.length).toEqual(1);

      const dto = data.find(({ id }) => id === uuid)?.attributes as unknown as DemographicDto;
      expect(dto).not.toBeNull();
      expect(dto.entries.length).toBe(3);
      expect(dto.entries.find(({ type, subtype }) => type === "gender" && subtype === "female")).toMatchObject(female);
      expect(dto.entries.find(({ type, subtype }) => type === "gender" && subtype === "unknown")).toMatchObject(
        unknown
      );
      expect(dto.entries.find(({ type, subtype }) => type === "age" && subtype === "youth")).toMatchObject(youth);

      expect(result.meta.indices?.length).toBe(1);
      expect(result.meta.indices?.[0]).toMatchObject({
        resource: "demographics",
        requestPath: `/entities/v3/projectReports/${projectReportUuid}/demographics`,
        ids: undefined
      });
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
        const data = pickApiProperties(seeding!, SeedingDto);
        if (data.taxonId === undefined) data.taxonId = null;
        expect(seedingData).toMatchObject(data);
      }
    });

    it("should memoize the base entity", async () => {
      const { uuid } = await SiteReportFactory.create();
      const spy = jest.spyOn(SiteReport, "findOne");
      const processor = service.createAssociationProcessor("siteReports", uuid, "seedings");
      const first = await processor.getBaseEntity();
      const second = await processor.getBaseEntity();
      expect(first).toBe(second);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
