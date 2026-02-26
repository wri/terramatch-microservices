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
  RoleFactory,
  ProjectFactory,
  ProjectUserFactory
} from "@terramatch-microservices/database/factories";
import {
  OrganisationUser,
  User,
  Notification,
  ProjectUser,
  ProjectInvite,
  Organisation,
  Role,
  ModelHasRole
} from "@terramatch-microservices/database/entities";
import { NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

describe("UserAssociationService", () => {
  let service: UserAssociationService;
  let jwtService: DeepMocked<JwtService>;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAssociationService,
        {
          provide: JwtService,
          useValue: (jwtService = createMock<JwtService>())
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

  describe("query", () => {
    it("should query ProjectUser records for a project", async () => {
      const project = await ProjectFactory.create();
      const projectUser1 = await ProjectUserFactory.create({ projectId: project.id });
      const projectUser2 = await ProjectUserFactory.create({ projectId: project.id });

      jest.spyOn(ProjectUser, "findAll").mockResolvedValue([projectUser1, projectUser2] as ProjectUser[]);

      const result = await service.query(project, {});

      expect(ProjectUser.findAll).toHaveBeenCalledWith({
        where: { projectId: project.id },
        attributes: ["id", "userId", "status", "isMonitoring", "isManaging"]
      });
      expect(result).toEqual([projectUser1, projectUser2]);
    });

    it("should filter by isManager when true", async () => {
      const project = await ProjectFactory.create();

      jest.spyOn(ProjectUser, "findAll").mockResolvedValue([]);

      await service.query(project, { isManager: true });

      expect(ProjectUser.findAll).toHaveBeenCalledWith({
        where: { projectId: project.id, isManaging: true },
        attributes: ["id", "userId", "status", "isMonitoring", "isManaging"]
      });
    });

    it("should filter by isMonitoring when isManager is false", async () => {
      const project = await ProjectFactory.create();

      jest.spyOn(ProjectUser, "findAll").mockResolvedValue([]);

      await service.query(project, { isManager: false });

      expect(ProjectUser.findAll).toHaveBeenCalledWith({
        where: { projectId: project.id, isMonitoring: true },
        attributes: ["id", "userId", "status", "isMonitoring", "isManaging"]
      });
    });
  });

  describe("addIndex", () => {
    it("should add user associations to document with correct DTOs", async () => {
      const project = await ProjectFactory.create();
      const org = await OrganisationFactory.create({ name: "Test Org" });
      const user1 = await UserFactory.create({ organisationId: org.id });
      const user2 = await UserFactory.create({ organisationId: org.id });
      const role1 = await RoleFactory.create();
      const role2 = await RoleFactory.create();

      const projectUser1 = await ProjectUserFactory.create({
        projectId: project.id,
        userId: user1.id,
        status: "approved",
        isManaging: true
      });
      const projectUser2 = await ProjectUserFactory.create({
        projectId: project.id,
        userId: user2.id,
        status: "requested",
        isMonitoring: true
      });

      user1.roles = [role1];
      user2.roles = [role2];

      jest.spyOn(User, "findAll").mockResolvedValue([user1, user2] as User[]);
      jest.spyOn(Organisation, "findAll").mockResolvedValue([org] as Organisation[]);
      const document = new DocumentBuilder("associatedUsers");

      const addDataSpy = jest.spyOn(document, "addData");
      const addIndexSpy = jest.spyOn(document, "addIndex");

      await service.addIndex(document, project, [projectUser1, projectUser2] as ProjectUser[], {});

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
          requestPath: expect.stringContaining(`/userAssociations/v3/projects/${project.uuid}`),
          total: 2,
          ids: [user1.uuid, user2.uuid]
        })
      );
    });

    it("should handle empty projectUsers array", async () => {
      const project = await ProjectFactory.create();
      const document = new DocumentBuilder("associatedUsers");

      jest.spyOn(User, "findAll").mockResolvedValue([]);
      const addIndexSpy = jest.spyOn(document, "addIndex");

      await service.addIndex(document, project, [], {});

      expect(addIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "associatedUsers",
          requestPath: expect.stringContaining(`/userAssociations/v3/projects/${project.uuid}`),
          total: 0,
          ids: []
        })
      );
    });
  });

  describe("createUserAssociation", () => {
    it("should return user when user exists", async () => {
      const project = await ProjectFactory.create();
      const user = await UserFactory.create();
      user.roles = [await RoleFactory.create()];

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectUser, "findOne").mockResolvedValue(null);
      jest.spyOn(ProjectUser, "create").mockResolvedValue({} as ProjectUser);
      jest.spyOn(ProjectInvite, "create").mockResolvedValue({} as ProjectInvite);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.createUserAssociation(project, {
        emailAddress: user.emailAddress,
        isManager: false
      });

      expect(result).toEqual(user);
    });

    it("should call handleUserNotFound when user does not exist", async () => {
      const project = await ProjectFactory.create();
      const org = await OrganisationFactory.create();
      project.organisationId = org.id;
      const newUser = await UserFactory.create({ organisationId: org.id });
      const role = await RoleFactory.create({ name: "project-developer" });

      jest.spyOn(User, "findOne").mockResolvedValue(null);
      jest.spyOn(User, "create").mockResolvedValue(newUser);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "create").mockResolvedValue({} as ModelHasRole);
      jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
      jest.spyOn(ProjectInvite, "create").mockResolvedValue({} as ProjectInvite);
      jwtService.signAsync.mockResolvedValue("fake-token");
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.createUserAssociation(project, {
        emailAddress: "new@example.com",
        isManager: false
      });

      expect(User.create).toHaveBeenCalled();
      expect(result).toEqual(newUser);
    });
  });

  describe("deleteBulkUserAssociations", () => {
    it("should delete project user associations", async () => {
      const project = await ProjectFactory.create();
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();

      jest.spyOn(User, "findAll").mockResolvedValue([user1, user2] as User[]);
      jest.spyOn(ProjectUser, "destroy").mockResolvedValue(2);
      jest.spyOn(ProjectInvite, "destroy").mockResolvedValue(2);

      const result = await service.deleteBulkUserAssociations(project.id, [user1.uuid as string, user2.uuid as string]);

      expect(User.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: [user1.uuid, user2.uuid] } },
        attributes: ["id", "uuid", "emailAddress"]
      });
      expect(ProjectUser.destroy).toHaveBeenCalledWith({
        where: { projectId: project.id, userId: { [Op.in]: [user1.id, user2.id] } }
      });
      expect(ProjectInvite.destroy).toHaveBeenCalledWith({
        where: { projectId: project.id, emailAddress: { [Op.in]: [user1.emailAddress, user2.emailAddress] } }
      });
      expect(result).toEqual([user1.uuid, user2.uuid]);
    });

    it("should throw NotFoundException when no users found", async () => {
      const project = await ProjectFactory.create();

      jest.spyOn(User, "findAll").mockResolvedValue([]);
      const destroySpy = jest.spyOn(ProjectUser, "destroy").mockResolvedValue(0);

      await expect(service.deleteBulkUserAssociations(project.id, ["non-existent-uuid"])).rejects.toThrow(
        NotFoundException
      );
      expect(destroySpy).not.toHaveBeenCalled();
    });
  });

  describe("handleExistingUser", () => {
    it("should create manager when isManager is true and user is project-manager", async () => {
      const project = await ProjectFactory.create();
      const role = await RoleFactory.create({ name: "project-manager" });
      const user = await UserFactory.create();
      user.roles = [role];

      jest.spyOn(ProjectUser, "findOne").mockResolvedValue(null);
      jest.spyOn(ProjectUser, "create").mockResolvedValue({} as ProjectUser);

      await service["handleExistingUser"](project, user, { emailAddress: user.emailAddress, isManager: true });

      expect(ProjectUser.create).toHaveBeenCalledWith({
        projectId: project.id,
        userId: user.id,
        isManaging: true
      });
    });

    it("should throw BadRequestException when user is not project-manager but isManager is true", async () => {
      const project = await ProjectFactory.create();
      const role = await RoleFactory.create({ name: "project-developer" });
      const user = await UserFactory.create();
      user.roles = [role];

      await expect(
        service["handleExistingUser"](project, user, { emailAddress: user.emailAddress, isManager: true })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when user is already a project manager", async () => {
      const project = await ProjectFactory.create();
      const role = await RoleFactory.create({ name: "project-manager" });
      const user = await UserFactory.create();
      user.roles = [role];
      const existingProjectUser = await ProjectUserFactory.create({
        projectId: project.id,
        userId: user.id,
        isManaging: true
      });

      jest.spyOn(ProjectUser, "findOne").mockResolvedValue(existingProjectUser);

      await expect(
        service["handleExistingUser"](project, user, { emailAddress: user.emailAddress, isManager: true })
      ).rejects.toThrow(BadRequestException);
    });

    it("should create monitoring user when isManager is false", async () => {
      const project = await ProjectFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(ProjectUser, "findOne").mockResolvedValue(null);
      jest.spyOn(ProjectUser, "create").mockResolvedValue({} as ProjectUser);
      jest.spyOn(ProjectInvite, "create").mockResolvedValue({} as ProjectInvite);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service["handleExistingUser"](project, user, { emailAddress: user.emailAddress, isManager: false });

      expect(ProjectUser.create).toHaveBeenCalledWith({
        projectId: project.id,
        userId: user.id,
        isMonitoring: true
      });
      expect(ProjectInvite.create).toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalled();
    });

    it("should not create ProjectUser if already exists when isManager is false", async () => {
      const project = await ProjectFactory.create();
      const user = await UserFactory.create();
      const existingProjectUser = await ProjectUserFactory.create({
        projectId: project.id,
        userId: user.id
      });

      jest.spyOn(ProjectUser, "findOne").mockResolvedValue(existingProjectUser);
      jest.spyOn(ProjectUser, "create");
      jest.spyOn(ProjectInvite, "create").mockResolvedValue({} as ProjectInvite);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service["handleExistingUser"](project, user, { emailAddress: user.emailAddress, isManager: false });

      expect(ProjectUser.create).not.toHaveBeenCalled();
      expect(ProjectInvite.create).toHaveBeenCalled();
    });
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
      const destroySpy = jest.spyOn(OrganisationUser, "destroy").mockResolvedValue(0);

      await expect(service.deleteBulkOrgUserAssociations(org.id, ["non-existent-uuid"])).rejects.toThrow(
        NotFoundException
      );
      expect(destroySpy).not.toHaveBeenCalled();
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
      const findOrCreateSpy = jest
        .spyOn(OrganisationUser, "findOrCreate")
        .mockResolvedValue([await OrganisationUserFactory.create(), false] as [OrganisationUser, boolean]);

      await expect(service.requestOrgJoin(org, 999)).rejects.toThrow(UnauthorizedException);
      expect(findOrCreateSpy).not.toHaveBeenCalled();
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

  describe("updateOrgUserStatus", () => {
    it("should approve a user and update organisationId", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "requested"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(orgUser);
      jest.spyOn(orgUser, "save").mockResolvedValue(orgUser);
      jest.spyOn(user, "save").mockResolvedValue(user);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.updateOrgUserStatus(org, user.uuid as string, "approved");

      expect(orgUser.status).toBe("approved");
      expect(orgUser.save).toHaveBeenCalled();
      expect(user.organisationId).toBe(org.id);
      expect(user.save).toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalledWith("organisationUserApproved", expect.any(Object));
      expect(result).toEqual(user);
    });

    it("should reject a user without updating organisationId", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "requested"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(orgUser);
      jest.spyOn(orgUser, "save").mockResolvedValue(orgUser);
      jest.spyOn(user, "save").mockResolvedValue(user);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service.updateOrgUserStatus(org, user.uuid as string, "rejected");

      expect(orgUser.status).toBe("rejected");
      expect(user.save).not.toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalledWith("organisationUserRejected", expect.any(Object));
    });

    it("should throw NotFoundException when user not found", async () => {
      const org = await OrganisationFactory.create();
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.updateOrgUserStatus(org, "non-existent-uuid", "approved")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw BadRequestException when no OrganisationUser relationship", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(null);

      await expect(service.updateOrgUserStatus(org, user.uuid as string, "approved")).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw BadRequestException when status is not 'requested'", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "approved"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(orgUser);

      await expect(service.updateOrgUserStatus(org, user.uuid as string, "approved")).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
