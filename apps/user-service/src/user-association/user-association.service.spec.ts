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
  Project,
  Role,
  ModelHasRole,
  OrganisationInvite,
  PasswordReset
} from "@terramatch-microservices/database/entities";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  UnprocessableEntityException
} from "@nestjs/common";
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

  describe("createProcessor", () => {
    describe("projects model", () => {
      it("should create processor with correct policies", () => {
        const processor = service.createProcessor("projects", "test-uuid");

        expect(processor.readPolicy).toBe("read");
        expect(processor.createPolicy).toBe("update");
        expect(processor.updatePolicy).toBe("update");
      });

      it("should load project entity on getEntity call", async () => {
        const project = await ProjectFactory.create();
        jest.spyOn(Project, "findOne").mockResolvedValue(project);

        const processor = service.createProcessor("projects", project.uuid);
        const entity = await processor.getEntity();

        expect(Project.findOne).toHaveBeenCalledWith({
          where: { uuid: project.uuid },
          attributes: ["id", "uuid", "frameworkKey", "organisationId"]
        });
        expect(entity).toEqual(project);
      });

      it("should cache entity on subsequent getEntity calls", async () => {
        const project = await ProjectFactory.create();
        jest.spyOn(Project, "findOne").mockResolvedValue(project);

        const processor = service.createProcessor("projects", project.uuid);
        await processor.getEntity();
        await processor.getEntity();

        expect(Project.findOne).toHaveBeenCalledTimes(1);
      });

      it("should throw NotFoundException when project not found", async () => {
        jest.spyOn(Project, "findOne").mockResolvedValue(null);

        const processor = service.createProcessor("projects", "non-existent-uuid");

        await expect(processor.getEntity()).rejects.toThrow(NotFoundException);
        await expect(processor.getEntity()).rejects.toThrow("Project not found");
      });

      it("should call addDtos through processor", async () => {
        const project = await ProjectFactory.create();
        const projectUser = await ProjectUserFactory.create({ projectId: project.id });
        jest.spyOn(Project, "findOne").mockResolvedValue(project);
        jest.spyOn(service, "query").mockResolvedValue([projectUser] as ProjectUser[]);
        jest.spyOn(service, "addIndex").mockResolvedValue(undefined);
        const document = new DocumentBuilder("associatedUsers");

        const processor = service.createProcessor("projects", project.uuid);
        await processor.addDtos(document, {});

        expect(service.query).toHaveBeenCalledWith(project, {});
        expect(service.addIndex).toHaveBeenCalledWith(document, project, [projectUser], {});
      });

      it("should call handleCreate through processor with body", async () => {
        const project = await ProjectFactory.create();
        const user = await UserFactory.create();
        jest.spyOn(Project, "findOne").mockResolvedValue(project);
        jest.spyOn(service, "createUserAssociation").mockResolvedValue(user);
        const document = new DocumentBuilder("associatedUsers");
        const body = {
          data: {
            type: "userAssociations",
            attributes: { emailAddress: "test@test.com", isManager: false }
          }
        };

        const processor = service.createProcessor("projects", project.uuid);
        await processor.handleCreate(document, body, 1);

        expect(service.createUserAssociation).toHaveBeenCalledWith(project, body.data.attributes);
      });

      it("should throw BadRequestException when handleCreate called without body for projects", async () => {
        const project = await ProjectFactory.create();
        jest.spyOn(Project, "findOne").mockResolvedValue(project);
        const document = new DocumentBuilder("associatedUsers");

        const processor = service.createProcessor("projects", project.uuid);

        await expect(processor.handleCreate(document, undefined, 1)).rejects.toThrow(BadRequestException);
        await expect(processor.handleCreate(document, undefined, 1)).rejects.toThrow(
          "Request body is required for project associations"
        );
      });

      it("should call handleDelete through processor", async () => {
        const project = await ProjectFactory.create();
        const user1 = await UserFactory.create();
        const user2 = await UserFactory.create();
        jest.spyOn(Project, "findOne").mockResolvedValue(project);
        jest
          .spyOn(service, "deleteBulkUserAssociations")
          .mockResolvedValue([user1.uuid as string, user2.uuid as string]);

        const processor = service.createProcessor("projects", project.uuid);
        await processor.handleDelete([user1.uuid as string, user2.uuid as string]);

        expect(service.deleteBulkUserAssociations).toHaveBeenCalledWith(project.id, [user1.uuid, user2.uuid]);
      });
    });

    describe("organisations model", () => {
      it("should create processor with correct policies", () => {
        const processor = service.createProcessor("organisations", "test-uuid");

        expect(processor.readPolicy).toBe("read");
        expect(processor.createPolicy).toBe("joinRequest");
        expect(processor.updatePolicy).toBe("update");
      });

      it("should load organisation entity on getEntity call", async () => {
        const org = await OrganisationFactory.create();
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);

        const processor = service.createProcessor("organisations", org.uuid);
        const entity = await processor.getEntity();

        expect(Organisation.findOne).toHaveBeenCalledWith({
          where: { uuid: org.uuid },
          attributes: ["id", "uuid", "name"]
        });
        expect(entity).toEqual(org);
      });

      it("should cache entity on subsequent getEntity calls", async () => {
        const org = await OrganisationFactory.create();
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);

        const processor = service.createProcessor("organisations", org.uuid);
        await processor.getEntity();
        await processor.getEntity();

        expect(Organisation.findOne).toHaveBeenCalledTimes(1);
      });

      it("should throw NotFoundException when organisation not found", async () => {
        jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

        const processor = service.createProcessor("organisations", "non-existent-uuid");

        await expect(processor.getEntity()).rejects.toThrow(NotFoundException);
        await expect(processor.getEntity()).rejects.toThrow("Organisation not found");
      });

      it("should call addDtos through processor", async () => {
        const org = await OrganisationFactory.create();
        const orgUser = await OrganisationUserFactory.create({ organisationId: org.id });
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
        jest.spyOn(service, "queryOrg").mockResolvedValue([orgUser] as OrganisationUser[]);
        jest.spyOn(service, "addOrgUserDtos").mockResolvedValue(undefined);
        const document = new DocumentBuilder("associatedUsers");

        const processor = service.createProcessor("organisations", org.uuid);
        await processor.addDtos(document, {});

        expect(service.queryOrg).toHaveBeenCalledWith(org, {});
        expect(service.addOrgUserDtos).toHaveBeenCalledWith(document, org, [orgUser], {});
      });

      it("should call handleCreate through processor for organisations", async () => {
        const org = await OrganisationFactory.create({ name: "Test Org" });
        const user = await UserFactory.create();
        user.roles = [await RoleFactory.create()];
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
        jest.spyOn(service, "requestOrgJoin").mockResolvedValue(user);
        jest.spyOn(User, "findOne").mockResolvedValue(user);
        const document = new DocumentBuilder("associatedUsers");
        const addDataSpy = jest.spyOn(document, "addData");

        const processor = service.createProcessor("organisations", org.uuid);
        await processor.handleCreate(document, undefined, user.id);

        expect(service.requestOrgJoin).toHaveBeenCalledWith(org, user.id);
        expect(User.findOne).toHaveBeenCalledWith({
          where: { id: user.id },
          attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "phoneNumber", "jobRole"],
          include: [{ association: "roles", attributes: ["name"] }]
        });
        expect(addDataSpy).toHaveBeenCalled();
      });

      it("should throw UnauthorizedException when user not found after requestOrgJoin", async () => {
        const org = await OrganisationFactory.create();
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
        jest.spyOn(service, "requestOrgJoin").mockResolvedValue({} as User);
        jest.spyOn(User, "findOne").mockResolvedValue(null);
        const document = new DocumentBuilder("associatedUsers");

        const processor = service.createProcessor("organisations", org.uuid);

        await expect(processor.handleCreate(document, undefined, 999)).rejects.toThrow(UnauthorizedException);
        await expect(processor.handleCreate(document, undefined, 999)).rejects.toThrow("Authenticated user not found");
      });

      it("should call handleDelete through processor", async () => {
        const org = await OrganisationFactory.create();
        const user1 = await UserFactory.create();
        const user2 = await UserFactory.create();
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
        jest
          .spyOn(service, "deleteBulkOrgUserAssociations")
          .mockResolvedValue([user1.uuid as string, user2.uuid as string]);

        const processor = service.createProcessor("organisations", org.uuid);
        await processor.handleDelete([user1.uuid as string, user2.uuid as string]);

        expect(service.deleteBulkOrgUserAssociations).toHaveBeenCalledWith(org.id, [user1.uuid, user2.uuid]);
      });

      it("should call handleUpdate through processor", async () => {
        const org = await OrganisationFactory.create();
        const user = await UserFactory.create();
        user.roles = [await RoleFactory.create()];
        jest.spyOn(Organisation, "findOne").mockResolvedValue(org);
        jest.spyOn(service, "updateOrgUserStatus").mockResolvedValue(user);
        const document = new DocumentBuilder("associatedUsers");
        const addDataSpy = jest.spyOn(document, "addData");

        const processor = service.createProcessor("organisations", org.uuid);
        await processor.handleUpdate(document, user.uuid as string, "approved");

        expect(service.updateOrgUserStatus).toHaveBeenCalledWith(org, user.uuid, "approved");
        expect(addDataSpy).toHaveBeenCalled();
      });
    });
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
        attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "organisationId", "phoneNumber", "jobRole"],
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
      const project = { id: 1, uuid: "project-uuid", organisationId: 1 } as Project;
      const org = { id: 1, uuid: "org-uuid", name: "Test Org" } as Organisation;
      const newUser = { id: 10, emailAddress: "new@example.com", organisationId: org.id } as User;
      const role = { id: 1, name: "project-developer" } as Role;

      jest.spyOn(User, "findOne").mockResolvedValue(null);
      jest.spyOn(User, "create").mockResolvedValue(newUser);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "create").mockResolvedValue({} as ModelHasRole);
      jest.spyOn(PasswordReset, "create").mockResolvedValue({} as PasswordReset);
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
        status: "active",
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

  describe("addOrgUserDtos", () => {
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

      const ownersMock = [{ id: user1.id }, { id: user2.id }];
      jest
        .spyOn(User, "findAll")
        .mockResolvedValueOnce(ownersMock as User[])
        .mockResolvedValueOnce([user1, user2] as User[]);
      const document = new DocumentBuilder("associatedUsers");

      const addDataSpy = jest.spyOn(document, "addData");
      const addIndexSpy = jest.spyOn(document, "addIndex");

      await service.addOrgUserDtos(document, org, [orgUser1, orgUser2] as OrganisationUser[], {});

      expect(User.findAll).toHaveBeenNthCalledWith(1, {
        where: { organisationId: org.id },
        attributes: ["id"]
      });
      expect(User.findAll).toHaveBeenNthCalledWith(2, {
        where: { id: { [Op.in]: [user1.id, user2.id] } },
        attributes: [
          "id",
          "uuid",
          "emailAddress",
          "firstName",
          "lastName",
          "organisationId",
          "phoneNumber",
          "jobRole",
          "lastLoggedInAt"
        ],
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

      await service.addOrgUserDtos(document, org, [], {});

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
      expect(emailQueue.add).toHaveBeenCalled();
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
      jest.spyOn(user, "save");
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.updateOrgUserStatus(org, user.uuid as string, "rejected");

      expect(orgUser.status).toBe("rejected");
      expect(orgUser.save).toHaveBeenCalled();
      expect(user.save).not.toHaveBeenCalled();
      expect(emailQueue.add).toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should allow approving a previously rejected user", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "rejected"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(orgUser);
      jest.spyOn(orgUser, "save").mockResolvedValue(orgUser);
      jest.spyOn(user, "save").mockResolvedValue(user);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      await service.updateOrgUserStatus(org, user.uuid as string, "approved");

      expect(orgUser.status).toBe("approved");
    });

    it("should throw NotFoundException when user not found", async () => {
      const org = await OrganisationFactory.create();

      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.updateOrgUserStatus(org, "non-existent-uuid", "approved")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw BadRequestException when user has no relationship with organisation", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(null);

      await expect(service.updateOrgUserStatus(org, user.uuid as string, "approved")).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateOrgUserStatus(org, user.uuid as string, "approved")).rejects.toThrow(
        "User does not have a relationship with this organisation"
      );
    });

    it("should throw BadRequestException when trying to approve an already approved user", async () => {
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

    it("should throw BadRequestException when trying to reject a non-requested user", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      const orgUser = await OrganisationUserFactory.create({
        organisationId: org.id,
        userId: user.id,
        status: "approved"
      });

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(OrganisationUser, "findOne").mockResolvedValue(orgUser);

      await expect(service.updateOrgUserStatus(org, user.uuid as string, "rejected")).rejects.toThrow(
        BadRequestException
      );
    });

    it("should handle email queue failure gracefully", async () => {
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
      emailQueue.add = jest.fn().mockRejectedValue(new Error("Queue error"));
      const errorSpy = jest.spyOn(service["logger"], "error");

      const result = await service.updateOrgUserStatus(org, user.uuid as string, "approved");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to queue organisation user approved email"),
        expect.any(Error)
      );
      expect(result).toEqual(user);
    });
  });
  describe("inviteOrganisationUser", () => {
    it("should throw UnprocessableEntityException when user with email already exists", async () => {
      const org = { id: 1, uuid: "org-uuid", name: "Test Org" } as Organisation;
      const user = { id: 1, emailAddress: "exists@example.com" } as User;

      jest.spyOn(User, "findOne").mockResolvedValue(user);

      await expect(service.inviteOrganisationUser(org, "exists@example.com")).rejects.toThrow(
        UnprocessableEntityException
      );
    });

    it("should create user, organisation invite and queue email when user does not exist", async () => {
      const org = { id: 1, uuid: "org-uuid", name: "Test Org" } as Organisation;
      const role = { id: 1, name: "project-developer" } as Role;
      const newUser = { id: 10, emailAddress: "new@example.com", organisationId: org.id } as User;
      const invite = {
        id: 1,
        uuid: "invite-uuid",
        organisationId: org.id,
        emailAddress: "new@example.com",
        token: "fake-token",
        acceptedAt: null,
        createdAt: new Date()
      } as OrganisationInvite;

      jest.spyOn(User, "findOne").mockResolvedValue(null);
      jest.spyOn(User, "create").mockResolvedValue(newUser);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "create").mockResolvedValue({} as ModelHasRole);
      jest.spyOn(PasswordReset, "create").mockResolvedValue({} as PasswordReset);
      jest.spyOn(OrganisationInvite, "create").mockResolvedValue(invite);
      emailQueue.add = jest.fn().mockResolvedValue({} as Job);

      const result = await service.inviteOrganisationUser(org, "new@example.com", "http://frontend/auth/signup");

      expect(User.create).toHaveBeenCalled();
      expect(Role.findOne).toHaveBeenCalledWith({ where: { name: "project-developer" } });
      expect(ModelHasRole.create).toHaveBeenCalled();
      expect(OrganisationInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: org.id,
          emailAddress: "new@example.com",
          token: expect.any(String)
        })
      );
      expect(emailQueue.add).toHaveBeenCalled();
      expect(result).toBe(invite);
    });
  });

  describe("acceptProjectInvite", () => {
    it("should throw UnauthorizedException when user not found", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.acceptProjectInvite("token", 1)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw NotFoundException when invite not found", async () => {
      const user = await UserFactory.create();
      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectInvite, "findOne").mockResolvedValue(null);

      await expect(service.acceptProjectInvite("token", user.id)).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when invite already accepted", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      const invite = {
        id: 1,
        token: "token",
        emailAddress: user.emailAddress,
        acceptedAt: new Date(),
        project
      } as ProjectInvite;

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectInvite, "findOne").mockResolvedValue(invite);

      await expect(service.acceptProjectInvite("token", user.id)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when project not found", async () => {
      const user = await UserFactory.create();
      const invite = {
        id: 1,
        token: "token",
        emailAddress: user.emailAddress,
        acceptedAt: null,
        project: null
      } as ProjectInvite;

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectInvite, "findOne").mockResolvedValue(invite);

      await expect(service.acceptProjectInvite("token", user.id)).rejects.toThrow(NotFoundException);
    });

    it("should create ProjectUser and accept invite when user association does not exist", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      const invite = {
        id: 1,
        token: "token",
        emailAddress: user.emailAddress,
        acceptedAt: null,
        project,
        save: jest.fn().mockResolvedValue({})
      } as unknown as ProjectInvite;

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectInvite, "findOne").mockResolvedValue(invite);
      jest
        .spyOn(ProjectUser, "findOrCreate")
        .mockResolvedValue([
          { id: 1, projectId: project.id, userId: user.id, isMonitoring: true, status: "active" } as ProjectUser,
          true
        ]);

      const result = await service.acceptProjectInvite("token", user.id);

      expect(ProjectUser.findOrCreate).toHaveBeenCalledWith({
        where: { projectId: project.id, userId: user.id },
        defaults: { projectId: project.id, userId: user.id, isMonitoring: true, status: "active" }
      });
      expect(invite.acceptedAt).toBeInstanceOf(Date);
      expect(invite.save).toHaveBeenCalled();
      expect(result).toEqual({ user, project, invite });
    });

    it("should update existing ProjectUser and accept invite", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      const projectUser = {
        id: 1,
        projectId: project.id,
        userId: user.id,
        isMonitoring: false,
        status: null,
        save: jest.fn().mockResolvedValue({})
      } as unknown as ProjectUser;
      const invite = {
        id: 1,
        token: "token",
        emailAddress: user.emailAddress,
        acceptedAt: null,
        project,
        save: jest.fn().mockResolvedValue({})
      } as unknown as ProjectInvite;

      jest.spyOn(User, "findOne").mockResolvedValue(user);
      jest.spyOn(ProjectInvite, "findOne").mockResolvedValue(invite);
      jest.spyOn(ProjectUser, "findOrCreate").mockResolvedValue([projectUser, false]);

      await service.acceptProjectInvite("token", user.id);

      expect(projectUser.isMonitoring).toBe(true);
      expect(projectUser.status).toBe("active");
      expect(projectUser.save).toHaveBeenCalled();
      expect(invite.acceptedAt).toBeInstanceOf(Date);
      expect(invite.save).toHaveBeenCalled();
    });
  });
});
