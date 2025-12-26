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
import { DemographicDto, DemographicEntryDto } from "@terramatch-microservices/common/dto/demographic.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { TreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";
import { SeedingDto } from "@terramatch-microservices/common/dto/seeding.dto";
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
      const projectReport = await ProjectReportFactory.create();
      const demographic = await DemographicFactory.projectReportJobs(projectReport).create();
      const female = pickApiProperties(
        await DemographicEntryFactory.gender(demographic, "female").create(),
        DemographicEntryDto
      );
      const unknown = pickApiProperties(
        await DemographicEntryFactory.gender(demographic, "unknown").create(),
        DemographicEntryDto
      );
      const youth = pickApiProperties(
        await DemographicEntryFactory.age(demographic, "youth").create(),
        DemographicEntryDto
      );

      const document = buildJsonApi(DemographicDto, { forceDataArray: true });
      await service.createAssociationProcessor("projectReports", projectReport.uuid, "demographics").addDtos(document);
      const result = document.serialize();
      const data = result.data as Resource[];
      expect(data.length).toEqual(1);

      const dto = data.find(({ id }) => id === demographic.uuid)?.attributes as unknown as DemographicDto;
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
        requestPath: `/entities/v3/projectReports/${projectReport.uuid}/demographics`,
        ids: undefined
      });
    });

    it("should include tree species", async () => {
      const siteReport = await SiteReportFactory.create();
      const species = await TreeSpeciesFactory.siteReportTreePlanted(siteReport).createMany(5);
      await TreeSpeciesFactory.siteReportTreePlanted(siteReport).create({ hidden: true });

      const document = buildJsonApi(TreeSpeciesDto, { forceDataArray: true });
      await service.createAssociationProcessor("siteReports", siteReport.uuid, "treeSpecies").addDtos(document);
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
      const report = await SiteReportFactory.create();
      const seedings = await SeedingFactory.siteReport(report).createMany(5);
      await SeedingFactory.siteReport(report).create({ hidden: true });

      const document = buildJsonApi(SeedingDto, { forceDataArray: true });
      await service.createAssociationProcessor("siteReports", report.uuid, "seedings").addDtos(document);
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
