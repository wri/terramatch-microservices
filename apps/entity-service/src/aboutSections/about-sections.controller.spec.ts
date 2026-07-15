import { Test, TestingModule } from "@nestjs/testing";
import { AboutSectionsController } from "./about-sections.controller";
import { AboutSectionsService } from "./about-sections.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { AboutSection } from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";

describe("AboutSectionsController", () => {
  let module: TestingModule;
  let controller: AboutSectionsController;

  const aboutSectionService = (): DeepMocked<AboutSectionsService> => module.get(AboutSectionsService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AboutSectionsController],
      providers: [{ provide: AboutSectionsService, useValue: createMock<AboutSectionsService>() }]
    }).compile();

    await AboutSection.truncate();

    controller = module.get(AboutSectionsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("calls addIndex on the service", async () => {
      const query: AboutSectionIndexQueryDto = { type: "project", framework: "terrafund" };
      await controller.index(query);
      expect(aboutSectionService().addIndex).toHaveBeenCalledWith(expect.any(DocumentBuilder), query);
    });
  });

  describe("get", () => {
    it("should throw if the section does not exist", async () => {
      await expect(() => controller.get({ uuid: "non-existent-section" })).rejects.toThrow(NotFoundException);
    });

    it("should return the requested section", async () => {
      const section = await AboutSection.create();
      serialize(await controller.get({ uuid: section.uuid }));
      expect(aboutSectionService().addDto).toHaveBeenCalledWith(
        expect.any(DocumentBuilder),
        expect.objectContaining({ id: section.id })
      );
    });
  });
});
