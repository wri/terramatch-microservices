import { Test, TestingModule } from "@nestjs/testing";
import { AboutSectionsController } from "./about-sections.controller";
import { AboutSectionsService } from "./about-sections.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { AboutSection } from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { StoreAboutSectionAttributes } from "./dto/about-section.dto";
import { AboutSectionFactory } from "@terramatch-microservices/database/factories";

describe("AboutSectionsController", () => {
  let module: TestingModule;
  let controller: AboutSectionsController;

  const aboutSectionService = (): DeepMocked<AboutSectionsService> => module.get(AboutSectionsService);
  const policyService = (): DeepMocked<PolicyService> => module.get(PolicyService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AboutSectionsController],
      providers: [
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        { provide: AboutSectionsService, useValue: createMock<AboutSectionsService>() }
      ]
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

  describe("create", () => {
    it("calls store on the service", async () => {
      const attributes = {} as StoreAboutSectionAttributes;
      await controller.create({ data: { type: "aboutSections", attributes } });
      expect(policyService().authorize).toHaveBeenCalledWith("create", AboutSection);
      expect(aboutSectionService().store).toHaveBeenCalledWith(attributes);
    });
  });

  describe("update", () => {
    it("checks the payload and URL UUID", async () => {
      await expect(
        controller.update("fake-uuid-1", {
          data: { type: "aboutSection", attributes: {} as StoreAboutSectionAttributes, id: "fake-uuid-2" }
        })
      ).rejects.toThrow("About section id in path and payload do not match");
    });

    it("throws if the section is not found", async () => {
      await expect(
        controller.update("fake-uuid", {
          data: { type: "aboutSection", attributes: {} as StoreAboutSectionAttributes, id: "fake-uuid" }
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("calls store on the service", async () => {
      const section = await AboutSectionFactory.create();
      const attributes = {} as StoreAboutSectionAttributes;
      await controller.update(section.uuid, { data: { id: section.uuid, type: "aboutSection", attributes } });

      expect(policyService().authorize).toHaveBeenCalledWith("update", expect.objectContaining({ id: section.id }));
      expect(aboutSectionService().store).toHaveBeenCalledWith(attributes, expect.objectContaining({ id: section.id }));
    });
  });

  describe("delete", () => {
    it("throws if the section is not found", async () => {
      await expect(controller.delete("fake-uuid")).rejects.toThrow(NotFoundException);
    });

    it("throws if the section is the default", async () => {
      await AboutSection.truncate();
      const section = await AboutSectionFactory.create();
      await expect(controller.delete(section.uuid)).rejects.toThrow("Deletion of default section is not allowed.");
    });

    it("deletes the section", async () => {
      await AboutSection.truncate();
      const section = await AboutSectionFactory.create({ frameworks: ["ppc"] });
      await controller.delete(section.uuid);
      await section.reload({ paranoid: false });
      expect(policyService().authorize).toHaveBeenCalledWith("delete", expect.objectContaining({ id: section.id }));
      expect(section.deletedAt).not.toBeNull();
    });
  });
});
