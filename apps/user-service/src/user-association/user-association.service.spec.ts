import { Test, TestingModule } from "@nestjs/testing";
import { UserAssociationService } from "./user-association.service";
import { JwtService } from "@nestjs/jwt";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Op } from "sequelize";
import {
  OrganisationFactory,
  UserFactory,
  OrganisationUserFactory,
  RoleFactory
} from "@terramatch-microservices/database/factories";
import { OrganisationUser, User, Notification } from "@terramatch-microservices/database/entities";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

describe("UserAssociationService", () => {
  let service: UserAssociationService;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAssociationService,
        {
          provide: JwtService,
          useValue: createMock<JwtService>()
        },
        {
          provide: getQueueToken("email"),
          useValue: (emailQueue = createMock<Queue>())
        }
      ]
    }).compile();

    service = module.get<UserAssociationService>(UserAssociationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("queryOrg", () => {
    it("should query OrganisationUser records for an organisation", async () => {
      const org = await OrganisationFactory.create();
      const orgUser1 = await OrganisationUserFactory.create({ organisationId: org.id });
      const orgUser2 = await OrganisationUserFactory.create({ organisationId: org.id });

      jest.spyOn(OrganisationUser, "findAll").mockResolvedValue([orgUser1, orgUser2] as OrganisationUser[]);

      const result = await service.queryOrg(org, {});

      expect(OrganisationUser.findAll).toHaveBeenCalledWith({
        where: { organisationId: org.id },
        attributes: ["id", "userId", "status"]
      });
      expect(result).toEqual([orgUser1, orgUser2]);
    });
  });

  describe("addOrgIndex", () => {
    it("should add user associations to document with correct DTOs", async () => {
      const org = await OrganisationFactory.create({ name: "Test Org" });
      const user1 = await UserFactory.create({ organisationId: org.id });
      const user2 = await UserFactory.create({ organisationId: org.id });
      const role1 = await RoleFactory.create();
      const role2 = await RoleFactory.create();

      const orgUser1 = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user1.id,
        status: "approved"
      });
      const orgUser2 = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user2.id,
        status: "requested"
      });

      user1.roles = [role1];
      user2.roles = [role2];

      jest.spyOn(User, "findAll").mockResolvedValue([user1, user2] as User[]);
      const document = new DocumentBuilder("associatedUsers");

      const addDataSpy = jest.spyOn(document, "addData");
      const addIndexSpy = jest.spyOn(document, "addIndex");

      await service.addOrgIndex(document, org, [orgUser1, orgUser2] as OrganisationUser[], {});

      expect(User.findAll).toHaveBeenCalledWith({
        where: { id: { [Op.in]: [user1.id, user2.id] } },
        attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "organisationId"],
        include: [
          {
            association: "roles",
            attributes: ["name"]
          }
        ]
      });
      expect(addDataSpy).toHaveBeenCalledTimes(2);
      expect(addIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "associatedUsers",
          requestPath: expect.stringContaining(`/userAssociations/v3/organisations/${org.uuid}`),
          total: 2,
          ids: [user1.uuid, user2.uuid]
        })
      );
    });

    it("should handle empty orgUsers array", async () => {
      const org = await OrganisationFactory.create();
      const document = new DocumentBuilder("associatedUsers");

      jest.spyOn(User, "findAll").mockResolvedValue([]);
      const addIndexSpy = jest.spyOn(document, "addIndex");

      await service.addOrgIndex(document, org, [], {});

      expect(addIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "associatedUsers",
          requestPath: expect.stringContaining(`/userAssociations/v3/organisations/${org.uuid}`),
          total: 0,
          ids: []
        })
      );
    });
  });

  describe("deleteBulkOrgUserAssociations", () => {
    it("should delete organisation user associations", async () => {
      const org = await OrganisationFactory.create();
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();

      jest.spyOn(User, "findAll").mockResolvedValue([user1, user2] as User[]);
      jest.spyOn(OrganisationUser, "destroy").mockResolvedValue(2);

      const result = await service.deleteBulkOrgUserAssociations(org.id, [user1.uuid as string, user2.uuid as string]);

      expect(User.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: [user1.uuid, user2.uuid] } },
        attributes: ["id", "uuid", "emailAddress"]
      });
      expect(OrganisationUser.destroy).toHaveBeenCalledWith({
        where: {
          organisationId: org.id,
          userId: { [Op.in]: [user1.id, user2.id] }
        }
      });
      expect(result).toEqual([user1.uuid, user2.uuid]);
    });

    it("should throw NotFoundException when no users found", async () => {
      const org = await OrganisationFactory.create();

      jest.spyOn(User, "findAll").mockResolvedValue([]);

      await expect(service.deleteBulkOrgUserAssociations(org.id, ["non-existent-uuid"])).rejects.toThrow(
        NotFoundException
      );
      expect(OrganisationUser.destroy).not.toHaveBeenCalled();
    });
  });

  describe("requestOrgJoin", () => {
    it("should create new organisation user join request", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const owner = await UserFactory.create({ organisationId: org.id });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOrCreate").mockResolvedValue([
        await OrganisationUserFactory.create({
          organisationId: org.id,
          userId: user.id,
          status: "requested"
        }),
        true
      ] as [OrganisationUser, boolean]);
      jest.spyOn(User, "findAll").mockResolvedValue([owner] as User[]);
      jest.spyOn(Notification, "bulkCreate").mockResolvedValue([]);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.requestOrgJoin(org, user.id);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: user.id },
        attributes: ["id", "uuid", "emailAddress"]
      });
      expect(OrganisationUser.findOrCreate).toHaveBeenCalledWith({
        where: { organisationId: org.id, userId: user.id },
        defaults: { organisationId: org.id, userId: user.id, status: "requested" }
      });
      expect(Notification.bulkCreate).toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should update existing organisation user status to requested", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "approved"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOrCreate").mockResolvedValue([orgUser, false] as [OrganisationUser, boolean]);
      jest.spyOn(orgUser, "save").mockResolvedValue(orgUser);
      jest.spyOn(User, "findAll").mockResolvedValue([]);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service.requestOrgJoin(org, user.id);

      expect(orgUser.status).toBe("requested");
      expect(orgUser.save).toHaveBeenCalled();
    });

    it("should not update status if already requested", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "requested"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOrCreate").mockResolvedValue([orgUser, false] as [OrganisationUser, boolean]);
      jest.spyOn(orgUser, "save");
      jest.spyOn(User, "findAll").mockResolvedValue([]);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service.requestOrgJoin(org, user.id);

      expect(orgUser.save).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when user not found", async () => {
      const org = await OrganisationFactory.create();

      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.requestOrgJoin(org, 999)).rejects.toThrow(UnauthorizedException);
      expect(OrganisationUser.findOrCreate).not.toHaveBeenCalled();
    });

    it("should not create notifications when no owners exist", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOrCreate").mockResolvedValue([
        await OrganisationUserFactory.create({
          organisationId: org.id,
          userId: user.id,
          status: "requested"
        }),
        true
      ] as [OrganisationUser, boolean]);
      jest.spyOn(User, "findAll").mockResolvedValue([]);
      jest.spyOn(Notification, "bulkCreate");
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service.requestOrgJoin(org, user.id);

      expect(Notification.bulkCreate).not.toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalled();
    });

    it("should handle email queue failure gracefully", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const owner = await UserFactory.create({ organisationId: org.id });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOrCreate").mockResolvedValue([
        await OrganisationUserFactory.create({
          organisationId: org.id,
          userId: user.id,
          status: "requested"
        }),
        true
      ] as [OrganisationUser, boolean]);
      jest.spyOn(User, "findAll").mockResolvedValue([owner] as User[]);
      jest.spyOn(Notification, "bulkCreate").mockResolvedValue([]);
      emailQueue.add = jest.fn().mockRejectedValue(new Error("Queue error"));
      const errorSpy = jest.spyOn(service["logger"], "error");

      const result = await service.requestOrgJoin(org, user.id);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to queue organisation join request email"),
        expect.any(Error)
      );
      expect(result).toEqual(user);
    });
  });
});
