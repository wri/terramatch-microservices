import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesController } from "./entities.controller";
import { EntitiesService } from "./entities.service";
import { Test } from "@nestjs/testing";
import { EntityProcessor } from "./processors/entity-processor";
import { ProjectFullDto, ProjectLightDto } from "./dto/project.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectFactory } from "@terramatch-microservices/database/factories";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { faker } from "@faker-js/faker";
import { EntityUpdateData } from "./dto/entity-update.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { EntityCreateAttributes } from "./dto/entity-create.dto";

class StubProcessor extends EntityProcessor<
  Project,
  ProjectLightDto,
  ProjectFullDto,
  EntityUpdateData,
  EntityCreateAttributes
> {
  LIGHT_DTO = ProjectLightDto;
  FULL_DTO = ProjectFullDto;

  findOne = jest.fn(() => Promise.resolve<Project | null>(null));
  findMany = jest.fn(() => Promise.resolve({ models: [], paginationTotal: 0 }));
  getFullDto = jest.fn(() =>
    Promise.resolve({
      id: "uuid",
      dto: new ProjectFullDto(new Project(), {} as HybridSupportProps<ProjectFullDto, Omit<Project, "application">>)
    })
  );
  getLightDto = jest.fn(() => Promise.resolve({ id: faker.string.uuid(), dto: new ProjectLightDto() }));
  delete = jest.fn(() => Promise.resolve());
  update = jest.fn(() => Promise.resolve());
  create = jest.fn(() => Promise.resolve(new Project()));
  loadAssociationData = jest.fn(() => Promise.resolve({} as Record<number, ProjectLightDto>));
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
      const projects = await ProjectFactory.createMany(2);
      // @ts-expect-error stub processor type issues
      processor.findMany.mockResolvedValue({ models: projects, paginationTotal: 2 });
      processor.loadAssociationData.mockResolvedValue({ [projects[0].id]: new ProjectLightDto() } as Record<
        number,
        ProjectLightDto
      >);
      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      policyService.authorize.mockResolvedValue();

      const result = serialize(await controller.entityIndex({ entity: "projects" }, {} as EntityQueryDto));
      expect(processor.getLightDto).toHaveBeenCalledTimes(2);
      expect(result.meta.indices?.[0]?.pageNumber).toBe(1);
      expect(result.meta.indices?.[0]?.total).toBe(2);
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
      const result = serialize(await controller.entityGet({ entity: "projects", uuid: "asdf" }));
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
      const result = serialize(await controller.entityDelete({ entity: "projects", uuid: project.uuid }));
      expect(processor.delete).toHaveBeenCalledWith(project);
      expect(result.meta.resourceType).toBe("projects");
      expect(result.meta.resourceIds).toStrictEqual([project.uuid]);
      expect(result.data).toBeUndefined();
    });
  });

  describe("entityUpdate", () => {
    it("should throw if the entity payload type does not match the path type", async () => {
      await expect(
        controller.entityUpdate(
          { entity: "sites", uuid: "asdf" },
          { data: { type: "projects", id: "asdf", attributes: {} } }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if the entity payload id does not match the path uuid", async () => {
      await expect(
        controller.entityUpdate(
          { entity: "projects", uuid: "asdf" },
          { data: { type: "projects", id: "qwerty", attributes: {} } }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if the model is not found", async () => {
      jest.spyOn(processor, "findOne").mockResolvedValue(null);
      await expect(
        controller.entityUpdate(
          { entity: "projects", uuid: "asdf" },
          { data: { type: "projects", id: "asdf", attributes: {} } }
        )
      ).rejects.toThrow(NotFoundException);
    });

    it("authorizes access to the model", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const { id, uuid } = project;
      policyService.authorize.mockRejectedValueOnce(new UnauthorizedException());
      await expect(
        controller.entityUpdate({ entity: "projects", uuid }, { data: { type: "projects", id: uuid, attributes: {} } })
      ).rejects.toThrow(UnauthorizedException);

      policyService.authorize.mockReset();
      policyService.authorize.mockResolvedValueOnce(undefined);
      await controller.entityUpdate(
        { entity: "projects", uuid },
        { data: { type: "projects", id: uuid, attributes: {} } }
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", expect.objectContaining({ id, uuid }));
    });

    it("calls update on the processor and creates the DTO", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const { uuid } = project;
      policyService.authorize.mockResolvedValueOnce(undefined);
      const attributes = { status: "approved", feedback: "foo" };
      await controller.entityUpdate({ entity: "projects", uuid }, { data: { type: "projects", id: uuid, attributes } });

      expect(processor.update).toHaveBeenCalledWith(project, attributes);
      expect(processor.getFullDto).toHaveBeenCalledWith(project);
    });
  });

  describe("entityCreate", () => {
    it("should throw if the entity payload type does not match the path type", async () => {
      await expect(
        controller.entityCreate(
          { entity: "sites" },
          {
            data: {
              type: "disturbanceReports",
              attributes: { parentUuid: "123e4567-e89b-12d3-a456-426614174000" }
            }
          }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should call create on the processor and return the created entity", async () => {
      const project = await ProjectFactory.create();
      processor.create.mockResolvedValue(project);
      const attributes = { parentUuid: "123e4567-e89b-12d3-a456-426614174000" };

      const result = serialize(
        await controller.entityCreate({ entity: "projects" }, { data: { type: "projects", attributes } })
      );

      expect(processor.create).toHaveBeenCalledWith(attributes);
      expect(processor.getFullDto).toHaveBeenCalledWith(project);
      expect(result.meta.resourceType).toBe("projects");
    });
  });
});
