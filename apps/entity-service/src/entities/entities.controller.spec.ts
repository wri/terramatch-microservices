import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesController } from "./entities.controller";
import { EntitiesService } from "./entities.service";
import { Test } from "@nestjs/testing";
import { EntityProcessor } from "./processors/entity-processor";
import { AdditionalProjectFullProps, ProjectFullDto, ProjectLightDto } from "./dto/project.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectFactory } from "@terramatch-microservices/database/factories";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { faker } from "@faker-js/faker";

class StubProcessor extends EntityProcessor<Project, ProjectLightDto, ProjectFullDto> {
  LIGHT_DTO = ProjectLightDto;
  FULL_DTO = ProjectFullDto;

  findOne = jest.fn(() => Promise.resolve(null));
  findMany = jest.fn(() => Promise.resolve({ models: [], paginationTotal: 0 }));
  getFullDto = jest.fn(() =>
    Promise.resolve({ id: "uuid", dto: new ProjectFullDto(new Project(), {} as AdditionalProjectFullProps) })
  );
  getLightDto = jest.fn(() => Promise.resolve({ id: faker.string.uuid(), dto: new ProjectLightDto() }));
  delete = jest.fn(() => Promise.resolve());
}

describe("EntitiesController", () => {
  let controller: EntitiesController;
  let entitiesService: DeepMocked<EntitiesService>;
  let policyService: DeepMocked<PolicyService>;
  let processor: StubProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [EntitiesController],
      providers: [
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId: 123 })) }
      ]
    }).compile();

    controller = module.get(EntitiesController);
    processor = new StubProcessor(entitiesService, "projects");
    entitiesService.createEntityProcessor.mockImplementation(() => processor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("entityIndex", () => {
    it("should call findMany", async () => {
      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      const query = { page: { number: 2 }, sort: { field: "name" }, status: "approved" } as EntityQueryDto;
      await controller.entityIndex({ entity: "projects" }, query);
      expect(processor.findMany).toHaveBeenCalledWith(query);
    });

    it("should add DTOs to the document", async () => {
      processor.findMany.mockResolvedValue({ models: await ProjectFactory.createMany(2), paginationTotal: 2 });
      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      policyService.authorize.mockResolvedValue();

      const result = await controller.entityIndex({ entity: "projects" }, {} as EntityQueryDto);
      expect(processor.getLightDto).toHaveBeenCalledTimes(2);
      expect(result.meta.indices[0]?.pageNumber).toBe(1);
      expect(result.meta.indices[0]?.total).toBe(2);
      expect(result.meta.resourceType).toBe("projects");
    });
  });

  describe("entityGet", () => {
    it("should call findMany", async () => {
      await expect(controller.entityGet({ entity: "projects", uuid: "asdf" })).rejects.toThrow(NotFoundException);
      expect(processor.findOne).toHaveBeenCalledWith("asdf");
    });

    it("should throw an error if the policy does not authorize", async () => {
      processor.findOne.mockResolvedValue(new Project());
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.entityGet({ entity: "projects", uuid: "asdf" })).rejects.toThrow(UnauthorizedException);
    });

    it("should add the DTO to the document", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      policyService.authorize.mockResolvedValue();
      const result = await controller.entityGet({ entity: "projects", uuid: "asdf" });
      expect(processor.getFullDto).toHaveBeenCalledWith(project);
      expect(result.meta.resourceType).toBe("projects");
    });
  });

  describe("entityDelete", () => {
    it("should call findOne", async () => {
      await expect(controller.entityDelete({ entity: "projects", uuid: "asdf" })).rejects.toThrow(NotFoundException);
      expect(processor.findOne).toHaveBeenCalledWith("asdf");
    });

    it("should throw if the policy does not authorize", async () => {
      processor.findOne.mockResolvedValue(new Project());
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.entityDelete({ entity: "projects", uuid: "asdf" })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should call delete on the processor", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      policyService.authorize.mockResolvedValue();
      const result = await controller.entityDelete({ entity: "projects", uuid: project.uuid });
      expect(processor.delete).toHaveBeenCalledWith(project, 123);
      expect(result.meta.resourceType).toBe("projects");
      expect(result.meta.resourceId).toBe(project.uuid);
      expect(result.data).toBeUndefined();
    });
  });
});
