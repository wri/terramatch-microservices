import { ProjectReport } from "@terramatch-microservices/database/entities";
import { Test, TestingModule } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { DemographicProcessor } from "./demographic.processor";
import {
  DemographicEntryFactory,
  DemographicFactory,
  ProjectReportFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi, DocumentBuilder, Resource } from "@terramatch-microservices/common/util";
import { DemographicDto, DemographicEntryDto } from "../dto/demographic.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";

describe("DemographicProcessor", () => {
  let module: TestingModule;
  let processor: DemographicProcessor<ProjectReport>;
  let projectReportId: number;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    const projectReport = await ProjectReportFactory.create();
    projectReportId = projectReport.id;
    processor = module
      .get(EntitiesService)
      .createAssociationProcessor("project-reports", projectReport.uuid, "demographics");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addDtos", () => {
    let document: DocumentBuilder;

    beforeEach(async () => {
      document = buildJsonApi(DemographicDto, { forceDataArray: true });
    });

    it("should include demographic entries", async () => {
      const { id: demographicId, uuid } = await DemographicFactory.forProjectReportJobs.create({
        demographicalId: projectReportId
      });
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

      await processor.addDtos(document);
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
    });
  });
});
