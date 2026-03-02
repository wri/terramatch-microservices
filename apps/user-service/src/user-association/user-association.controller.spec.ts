import { UserAssociationController } from "./user-association.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserAssociationService, UserAssociationProcessor } from "./user-association.service";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UserAssociationUpdateBody } from "./dto/user-association-update.dto";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationFactory, UserFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { UserAssociationDto } from "./dto/user-association.dto";

function makeStubProcessor(overrides: Partial<UserAssociationProcessor> = {}): UserAssociationProcessor {
  return {
    getEntity: jest.fn(),
    readPolicy: "read",
    createPolicy: "update",
    updatePolicy: "update",
    approveRejectPolicy: "approveReject",
    addDtos: jest.fn().mockResolvedValue(undefined),
    handleCreate: jest.fn().mockResolvedValue(undefined),
    handleDelete: jest.fn().mockResolvedValue(undefined),
    handleUpdate: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("UserAssociationController", () => {
  let controller: UserAssociationController;
  let policyService: DeepMocked<PolicyService>;
  let userAssociationService: DeepMocked<UserAssociationService>;
  let stubProcessor: UserAssociationProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserAssociationController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: UserAssociationService,
          useValue: (userAssociationService = createMock<UserAssociationService>())
        },
        { provide: getQueueToken("email"), useValue: createMock<Queue>() },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(UserAssociationController);
    stubProcessor = makeStubProcessor();
    userAssociationService.createProcessor.mockReturnValue(stubProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getUserAssociation", () => {
    it("should call createProcessor and delegate to addDtos", async () => {
      const project = await ProjectFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);

      const result = serialize(await controller.getUserAssociation({ model: "projects", uuid: project.uuid }, {}));

      expect(userAssociationService.createProcessor).toHaveBeenCalledWith("projects", project.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", project);
      expect(stubProcessor.addDtos).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it("should propagate NotFoundException from getEntity", async () => {
      (stubProcessor.getEntity as jest.Mock).mockRejectedValue(new NotFoundException("Project not found"));

      await expect(controller.getUserAssociation({ model: "projects", uuid: "bad-uuid" }, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it("should propagate UnauthorizedException when policy denies", async () => {
      const project = await ProjectFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getUserAssociation({ model: "projects", uuid: project.uuid }, {})).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("createUserAssociation", () => {
    it("should authorize with 'update' policy for projects", async () => {
      const project = await ProjectFactory.create();
      stubProcessor = makeStubProcessor({ createPolicy: "update" });
      userAssociationService.createProcessor.mockReturnValue(stubProcessor);
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);

      await controller.createUserAssociation(
        { model: "projects", uuid: project.uuid },
        {
          data: { type: "userAssociations", attributes: { emailAddress: "test@test.com", isManager: false } }
        }
      );

      expect(userAssociationService.createProcessor).toHaveBeenCalledWith("projects", project.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("update", project);
      expect(stubProcessor.handleCreate).toHaveBeenCalled();
    });

    it("should authorize with 'joinRequest' policy for organisations", async () => {
      const org = await OrganisationFactory.create();
      stubProcessor = makeStubProcessor({ createPolicy: "joinRequest" });
      userAssociationService.createProcessor.mockReturnValue(stubProcessor);
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);
      Object.defineProperty(policyService, "userId", { value: 1, writable: true, configurable: true });

      await controller.createUserAssociation({ model: "organisations", uuid: org.uuid });

      expect(userAssociationService.createProcessor).toHaveBeenCalledWith("organisations", org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("joinRequest", org);
      expect(stubProcessor.handleCreate).toHaveBeenCalled();
    });

    it("should propagate BadRequestException from handleCreate (e.g. missing body for projects)", async () => {
      const project = await ProjectFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);
      (stubProcessor.handleCreate as jest.Mock).mockRejectedValue(
        new BadRequestException("Request body is required for project associations")
      );

      await expect(
        controller.createUserAssociation({ model: "projects", uuid: project.uuid }, undefined)
      ).rejects.toThrow(BadRequestException);
    });

    it("should propagate NotFoundException from getEntity", async () => {
      (stubProcessor.getEntity as jest.Mock).mockRejectedValue(new NotFoundException("Project not found"));

      await expect(controller.createUserAssociation({ model: "projects", uuid: "bad-uuid" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should propagate UnauthorizedException from handleCreate (e.g. user not found after org join)", async () => {
      const org = await OrganisationFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);
      (stubProcessor.handleCreate as jest.Mock).mockRejectedValue(
        new UnauthorizedException("Authenticated user not found")
      );

      await expect(controller.createUserAssociation({ model: "organisations", uuid: org.uuid })).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("deleteUserAssociations", () => {
    it("should call handleDelete and return deleted response", async () => {
      const project = await ProjectFactory.create();
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);

      const result = serialize(
        await controller.deleteUserAssociations(
          { model: "projects", uuid: project.uuid },
          {
            uuids: [user1.uuid as string, user2.uuid as string]
          }
        )
      );

      expect(userAssociationService.createProcessor).toHaveBeenCalledWith("projects", project.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("update", project);
      expect(stubProcessor.handleDelete).toHaveBeenCalledWith([user1.uuid, user2.uuid]);
      expect(result.meta).toBeDefined();
      expect((result.meta as { resourceIds?: string[] })?.resourceIds).toEqual([user1.uuid, user2.uuid]);
    });

    it("should propagate NotFoundException from getEntity", async () => {
      (stubProcessor.getEntity as jest.Mock).mockRejectedValue(new NotFoundException("Organisation not found"));

      await expect(
        controller.deleteUserAssociations({ model: "organisations", uuid: "bad-uuid" }, { uuids: [] })
      ).rejects.toThrow(NotFoundException);
    });

    it("should propagate UnauthorizedException when policy denies", async () => {
      const org = await OrganisationFactory.create();
      (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.deleteUserAssociations({ model: "organisations", uuid: org.uuid }, { uuids: [] })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("updateUserAssociation", () => {
    const makeBody = (status: "approved" | "rejected"): UserAssociationUpdateBody => ({
      data: { type: "associatedUsers", attributes: { status } }
    });

    describe("model = organisations", () => {
      it("should approve a user and return UserAssociationDto", async () => {
        const org = await OrganisationFactory.create({ name: "Test Org" });
        const user = await UserFactory.create();

        stubProcessor = makeStubProcessor({
          approveRejectPolicy: "approveReject",
          handleUpdate: jest.fn().mockImplementation(async (document, userUuid, status) => {
            document.addData(
              userUuid,
              new UserAssociationDto(user, {
                status,
                isManager: false,
                organisationName: org.name ?? "",
                roleName: user.primaryRole ?? null,
                associatedType: "organisations"
              })
            );
          })
        });
        userAssociationService.createProcessor.mockReturnValue(stubProcessor);
        (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);

        const result = serialize(
          await controller.updateUserAssociation(
            { model: "organisations", uuid: org.uuid, userUuid: user.uuid as string },
            makeBody("approved")
          )
        );

        expect(userAssociationService.createProcessor).toHaveBeenCalledWith("organisations", org.uuid);
        expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
        expect(stubProcessor.handleUpdate).toHaveBeenCalledWith(expect.any(Object), user.uuid, "approved");
        expect(result.data != null).toBe(true);
        expect((result.data as Resource).id).toBe(user.uuid);
      });

      it("should reject a user and return UserAssociationDto", async () => {
        const org = await OrganisationFactory.create({ name: "Test Org" });
        const user = await UserFactory.create();

        stubProcessor = makeStubProcessor({
          approveRejectPolicy: "approveReject",
          handleUpdate: jest.fn().mockImplementation(async (document, userUuid, status) => {
            document.addData(
              userUuid,
              new UserAssociationDto(user, {
                status,
                isManager: false,
                organisationName: org.name ?? "",
                roleName: user.primaryRole ?? null,
                associatedType: "organisations"
              })
            );
          })
        });
        userAssociationService.createProcessor.mockReturnValue(stubProcessor);
        (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);

        const result = serialize(
          await controller.updateUserAssociation(
            { model: "organisations", uuid: org.uuid, userUuid: user.uuid as string },
            makeBody("rejected")
          )
        );

        expect(stubProcessor.handleUpdate).toHaveBeenCalledWith(expect.any(Object), user.uuid, "rejected");
        expect(result.data != null).toBe(true);
        expect((result.data as Resource).id).toBe(user.uuid);
      });

      it("should throw NotFoundException when organisation does not exist", async () => {
        (stubProcessor.getEntity as jest.Mock).mockRejectedValue(new NotFoundException("Organisation not found"));

        await expect(
          controller.updateUserAssociation(
            { model: "organisations", uuid: "non-existent-uuid", userUuid: "user-uuid" },
            makeBody("approved")
          )
        ).rejects.toThrow(NotFoundException);
      });

      it("should throw UnauthorizedException when policy denies", async () => {
        const org = await OrganisationFactory.create();
        (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);
        policyService.authorize.mockRejectedValue(new UnauthorizedException());

        await expect(
          controller.updateUserAssociation(
            { model: "organisations", uuid: org.uuid, userUuid: "user-uuid" },
            makeBody("approved")
          )
        ).rejects.toThrow(UnauthorizedException);
      });

      it("should propagate BadRequestException from handleUpdate", async () => {
        const org = await OrganisationFactory.create();
        (stubProcessor.getEntity as jest.Mock).mockResolvedValue(org);
        (stubProcessor.handleUpdate as jest.Mock).mockRejectedValue(
          new BadRequestException("User status is 'approved', expected 'requested'")
        );

        await expect(
          controller.updateUserAssociation(
            { model: "organisations", uuid: org.uuid, userUuid: "user-uuid" },
            makeBody("approved")
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe("model = projects", () => {
      it("should throw BadRequestException when trying to update project user association", async () => {
        const project = await ProjectFactory.create();
        stubProcessor = makeStubProcessor({
          approveRejectPolicy: "update",
          handleUpdate: jest
            .fn()
            .mockRejectedValue(new BadRequestException("Update status is not supported for projects"))
        });
        userAssociationService.createProcessor.mockReturnValue(stubProcessor);
        (stubProcessor.getEntity as jest.Mock).mockResolvedValue(project);

        await expect(
          controller.updateUserAssociation(
            { model: "projects", uuid: project.uuid, userUuid: "user-uuid" },
            makeBody("approved")
          )
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
