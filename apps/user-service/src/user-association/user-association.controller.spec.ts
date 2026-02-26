import { UserAssociationController } from "./user-association.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserAssociationService } from "./user-association.service";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { REQUEST } from "@nestjs/core";
import {
  OrganisationFactory,
  UserFactory,
  OrganisationUserFactory
} from "@terramatch-microservices/database/factories";
import { Organisation, OrganisationUser } from "@terramatch-microservices/database/entities";
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
});
