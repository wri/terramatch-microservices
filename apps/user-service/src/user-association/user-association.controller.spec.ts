import { UserAssociationController } from "./user-association.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserAssociationService } from "./user-association.service";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { REQUEST } from "@nestjs/core";
import {
  OrganisationFactory,
  UserFactory,
  OrganisationUserFactory,
  ProjectFactory,
  ProjectUserFactory
} from "@terramatch-microservices/database/factories";
import {
  Organisation,
  OrganisationUser,
  User,
  Project,
  ProjectUser
} from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";

describe("UserAssociationController", () => {
  let controller: UserAssociationController;
  let policyService: DeepMocked<PolicyService>;
  let userAssociationService: DeepMocked<UserAssociationService>;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserAssociationController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: UserAssociationService,
          useValue: (userAssociationService = createMock<UserAssociationService>())
        },
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(UserAssociationController);
    emailQueue.add = jest.fn().mockResolvedValue({} as Job);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getUserAssociation", () => {
    it("should return user associations for a project", async () => {
      const project = await ProjectFactory.create();
      const projectUser1 = await ProjectUserFactory.create({ projectId: project.id });
      const projectUser2 = await ProjectUserFactory.create({ projectId: project.id });

      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.query.mockResolvedValue([projectUser1, projectUser2] as ProjectUser[]);
      userAssociationService.addIndex.mockResolvedValue(undefined);

      const result = serialize(await controller.getUserAssociation(project.uuid, {}));

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: project.uuid },
        attributes: ["id", "uuid", "frameworkKey", "organisationId"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("read", project);
      expect(userAssociationService.query).toHaveBeenCalledWith(project, {});
      expect(userAssociationService.addIndex).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it("should throw NotFoundException when project does not exist", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);

      await expect(controller.getUserAssociation("non-existent-uuid", {})).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const project = await ProjectFactory.create();
      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getUserAssociation(project.uuid, {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("createUserAssociation", () => {
    it("should create user association and return UserAssociationDto", async () => {
      const project = await ProjectFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.createUserAssociation.mockResolvedValue(user);

      const result = serialize(
        await controller.createUserAssociation(project.uuid, {
          data: {
            type: "userAssociations",
            attributes: {
              emailAddress: user.emailAddress,
              isManager: false
            }
          }
        })
      );

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: project.uuid },
        attributes: ["id", "uuid", "frameworkKey", "organisationId"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("update", project);
      expect(userAssociationService.createUserAssociation).toHaveBeenCalledWith(project, {
        emailAddress: user.emailAddress,
        isManager: false
      });
      expect(result.data != null).toBe(true);
      expect((result.data as Resource).id).toBe(user.uuid);
    });

    it("should throw NotFoundException when project does not exist", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);

      await expect(
        controller.createUserAssociation("non-existent-uuid", {
          data: {
            type: "userAssociations",
            attributes: {
              emailAddress: "test@example.com",
              isManager: false
            }
          }
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const project = await ProjectFactory.create();
      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.createUserAssociation(project.uuid, {
          data: {
            type: "userAssociations",
            attributes: {
              emailAddress: "test@example.com",
              isManager: false
            }
          }
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("deleteBulkUserAssociations", () => {
    it("should delete user associations for a project", async () => {
      const project = await ProjectFactory.create();
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();

      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.deleteBulkUserAssociations.mockResolvedValue([user1.uuid as string, user2.uuid as string]);

      const result = serialize(
        await controller.deleteBulkUserAssociations(project.uuid, {
          uuids: [user1.uuid as string, user2.uuid as string]
        })
      );

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: project.uuid },
        attributes: ["id", "uuid", "frameworkKey", "organisationId"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("update", project);
      expect(userAssociationService.deleteBulkUserAssociations).toHaveBeenCalledWith(project.id, [
        user1.uuid,
        user2.uuid
      ]);
      expect(result.meta).toBeDefined();
      expect((result.meta as { resourceIds?: string[] })?.resourceIds).toEqual([user1.uuid, user2.uuid]);
    });

    it("should throw NotFoundException when project does not exist", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);

      await expect(controller.deleteBulkUserAssociations("non-existent-uuid", { uuids: [] })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const project = await ProjectFactory.create();
      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.deleteBulkUserAssociations(project.uuid, { uuids: [] })).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("createOrgUserAssociation", () => {
    it("should create an org join request and return a UserAssociationDto", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", { value: user.id, writable: true, configurable: true });
      userAssociationService.requestOrgJoin.mockResolvedValue(user);

      const result = serialize(await controller.createOrgUserAssociation(org.uuid));

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: org.uuid },
        attributes: ["id", "uuid", "name"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("joinRequest", org);
      expect(userAssociationService.requestOrgJoin).toHaveBeenCalledWith(org, user.id);
      expect(result.data != null).toBe(true);
      expect((result.data as Resource).id).toBe(user.uuid);
      expect((result.data as Resource).attributes?.status).toBe("requested");
    });

    it("should throw NotFoundException when organisation does not exist", async () => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(controller.createOrgUserAssociation("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const org = await OrganisationFactory.create();
      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createOrgUserAssociation(org.uuid)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when user is not found after requestOrgJoin", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", { value: user.id, writable: true, configurable: true });
      userAssociationService.requestOrgJoin.mockResolvedValue(user);
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(controller.createOrgUserAssociation(org.uuid)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("getOrgUserAssociation", () => {
    it("should return user associations for an organisation", async () => {
      const org = await OrganisationFactory.create();
      const orgUser1 = await OrganisationUserFactory.create({ organisationId: org.id });
      const orgUser2 = await OrganisationUserFactory.create({ organisationId: org.id });

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.queryOrg.mockResolvedValue([orgUser1, orgUser2] as OrganisationUser[]);
      userAssociationService.addOrgIndex.mockResolvedValue(undefined);

      const result = serialize(await controller.getOrgUserAssociation(org.uuid, {}));

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: org.uuid },
        attributes: ["id", "uuid", "name"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("read", org);
      expect(userAssociationService.queryOrg).toHaveBeenCalledWith(org, {});
      expect(userAssociationService.addOrgIndex).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it("should throw NotFoundException when organisation does not exist", async () => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(controller.getOrgUserAssociation("non-existent-uuid", {})).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const org = await OrganisationFactory.create();
      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getOrgUserAssociation(org.uuid, {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("deleteBulkOrgUserAssociations", () => {
    it("should delete user associations for an organisation", async () => {
      const org = await OrganisationFactory.create();
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.deleteBulkOrgUserAssociations.mockResolvedValue([
        user1.uuid as string,
        user2.uuid as string
      ]);

      const result = serialize(
        await controller.deleteBulkOrgUserAssociations(org.uuid, {
          uuids: [user1.uuid as string, user2.uuid as string]
        })
      );

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: org.uuid },
        attributes: ["id", "uuid", "name"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("update", org);
      expect(userAssociationService.deleteBulkOrgUserAssociations).toHaveBeenCalledWith(org.id, [
        user1.uuid,
        user2.uuid
      ]);
      expect(result.meta).toBeDefined();
      expect((result.meta as { resourceIds?: string[] })?.resourceIds).toEqual([user1.uuid, user2.uuid]);
    });

    it("should throw NotFoundException when organisation does not exist", async () => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(controller.deleteBulkOrgUserAssociations("non-existent-uuid", { uuids: [] })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const org = await OrganisationFactory.create();
      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.deleteBulkOrgUserAssociations(org.uuid, { uuids: [] })).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("updateOrgUserAssociation", () => {
    const makeBody = (status: "approved" | "rejected") => ({
      data: { type: "associatedUsers", attributes: { status } }
    });

    it("should approve a user and return UserAssociationDto", async () => {
      const org = await OrganisationFactory.create({ name: "Test Org" });
      const user = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.updateOrgUserStatus.mockResolvedValue(user);

      const result = serialize(
        await controller.updateOrgUserAssociation(org.uuid, user.uuid as string, makeBody("approved"))
      );

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: org.uuid },
        attributes: ["id", "uuid", "name"]
      });
      expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
      expect(userAssociationService.updateOrgUserStatus).toHaveBeenCalledWith(org, user.uuid, "approved");
      expect((result.data as Resource).id).toBe(user.uuid);
      expect((result.data as Resource).attributes?.status).toBe("approved");
    });

    it("should reject a user and return UserAssociationDto", async () => {
      const org = await OrganisationFactory.create({ name: "Test Org" });
      const user = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.updateOrgUserStatus.mockResolvedValue(user);

      const result = serialize(
        await controller.updateOrgUserAssociation(org.uuid, user.uuid as string, makeBody("rejected"))
      );

      expect((result.data as Resource).attributes?.status).toBe("rejected");
    });

    it("should throw NotFoundException when organisation does not exist", async () => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(
        controller.updateOrgUserAssociation("non-existent-uuid", "user-uuid", makeBody("approved"))
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when policy denies", async () => {
      const org = await OrganisationFactory.create();
      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.updateOrgUserAssociation(org.uuid, "user-uuid", makeBody("approved"))).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should propagate BadRequestException from service", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);
      userAssociationService.updateOrgUserStatus.mockRejectedValue(
        new BadRequestException("User status is 'approved', expected 'requested'")
      );

      await expect(
        controller.updateOrgUserAssociation(org.uuid, user.uuid as string, makeBody("approved"))
      ).rejects.toThrow(BadRequestException);
    });
  });
});
