import { Project } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { SiteProcessor } from "./site.processor";

describe("SiteProcessor", () => {
  let processor: SiteProcessor;

  beforeEach(async () => {
    await Project.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createProcessor("sites") as SiteProcessor;
  });

  describe("findMany", () => {
    it("throws", async () => {
      await expect(processor.findMany()).rejects.toThrow();
    });
  });

  describe("findOne", () => {
    it("throws", async () => {
      await expect(processor.findOne()).rejects.toThrow();
    });
  });

  describe("DTOs", () => {
    it("throws", async () => {
      await expect(processor.addLightDto()).rejects.toThrow();
      await expect(processor.addFullDto()).rejects.toThrow();
    });
  });
});
