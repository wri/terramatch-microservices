/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { Relationship, Resource } from "@terramatch-microservices/common/util";
import { UserCreateAttributes } from "./dto/user-create.dto";
import { UserCreationService } from "./user-creation.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import { UsersService } from "./users.service";
import { User } from "@terramatch-microservices/database/entities";

const createRequest = (attributes: UserCreateAttributes = new UserCreateAttributes()) => ({
  data: { type: "users", attributes }
});

describe("UsersController", () => {
  let controller: UsersController;
  let policyService: DeepMocked<PolicyService>;
  let userCreationService: DeepMocked<UserCreationService>;
  let usersService: DeepMocked<UsersService>;
  let realUsersService: UsersService;
  beforeEach(async () => {
    realUsersService = new UsersService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: UserCreationService, useValue: (userCreationService = createMock<UserCreationService>()) },
        { provide: UsersService, useValue: (usersService = createMock<UsersService>()) }
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService.update.mockImplementation((user, attrs) => realUsersService.update(user, attrs));
    usersService.getMonitoringPartnerProjectRecords.mockImplementation(user =>
      realUsersService.getMonitoringPartnerProjectRecords(user)
    );
    usersService.delete.mockImplementation(async u => {
      await realUsersService.delete(u);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findOne", () => {
    it("should throw not found if the user is not found", async () => {
      mockUserId(1);
      await expect(controller.findOne("0")).rejects.toThrow(NotFoundException);
    });

    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const { uuid } = await UserFactory.create();
      mockUserId(1);
      await expect(controller.findOne(uuid!)).rejects.toThrow(UnauthorizedException);
    });

    it('should return the currently logged in user if the id is "me"', async () => {
      const { id, uuid } = await UserFactory.create();
      mockUserId(id);
      const result = serialize(await controller.findOne("me"));
      expect((result.data as Resource).id).toBe(uuid);
    });

    it("should return the indicated user if the logged in user is allowed to access", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const { id, uuid } = await UserFactory.create();
      mockUserId(id + 1);
      const result = serialize(await controller.findOne(uuid!));
      expect((result.data as Resource).id).toBe(uuid);
    });

    it("should return a document without includes if there is no org", async () => {
      const { id } = await UserFactory.create();
      mockUserId(id);
      const result = serialize(await controller.findOne("me"));
      expect(result.included).not.toBeDefined();
    });

    it("should include the primary org for the user", async () => {
      const user = await UserFactory.create();
      const org = await OrganisationFactory.create();
      await user.$add("organisationsConfirmed", org);
      mockUserId(user.id);
      const result = serialize(await controller.findOne("me"));
      expect(result.included).toHaveLength(1);
      expect(result.included![0]).toMatchObject({ type: "organisations", id: org.uuid });
      const data = result.data as Resource;
      expect(data.relationships?.org).toBeDefined();
      const relationship = data.relationships!.org.data as Relationship;
      expect(relationship).toMatchObject({
        type: "organisations",
        id: org.uuid,
        meta: { userStatus: "approved" }
      });
    });

    it('should return "approved" for userStatus if user belongs to org without many-to-many relationship', async () => {
      const user = await UserFactory.create();
      const org = await OrganisationFactory.create();
      await user.$set("organisation", org);
      mockUserId(user.id);
      const result = serialize(await controller.findOne("me"));
      expect(result.included).toHaveLength(1);
      expect(result.included![0]).toMatchObject({ type: "organisations", id: org.uuid });
      const data = result.data as Resource;
      expect(data.relationships?.org).toBeDefined();
      const relationship = data.relationships!.org.data as Relationship;
      expect(relationship).toMatchObject({
        type: "organisations",
        id: org.uuid,
        meta: { userStatus: "approved" }
      });
    });

    it("should sideload monitoring partner projects via relationships and included", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const user = await UserFactory.create();
      const project = await ProjectFactory.create({ name: "Monitoring Partner Project" });
      await ProjectUserFactory.create({
        userId: user.id,
        projectId: project.id,
        isMonitoring: true,
        isManaging: false
      });
      mockUserId(user.id + 1);

      const result = serialize(await controller.findOne(user.uuid!));
      const data = result.data as Resource;
      const rel = data.relationships?.monitoringPartnerProjects?.data;
      expect(rel).toEqual({
        type: "projects",
        id: project.uuid
      });
      expect(result.included).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "projects",
            id: project.uuid,
            attributes: expect.objectContaining({
              uuid: project.uuid,
              name: "Monitoring Partner Project"
            })
          })
        ])
      );
    });
  });

  describe("verifyUser", () => {
    it("should throw not found if the user is not found", async () => {
      mockUserId(1);
      await expect(controller.verifyUser("missing-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw unauthorized if policy does not authorize", async () => {
      const { uuid } = await UserFactory.create();
      mockUserId(1);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.verifyUser(uuid!)).rejects.toThrow(UnauthorizedException);
    });

    it("should verify user and return JSON:API document", async () => {
      const user = await UserFactory.create({ emailAddressVerifiedAt: null });
      mockUserId(1);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.verifyUser(user.uuid!));
      const data = result.data as Resource;

      expect(data.id).toBe(user.uuid);
      const reloaded = await User.findOne({ where: { id: user.id } });
      expect(reloaded?.emailAddressVerifiedAt).not.toBeNull();
    });
  });

  describe("delete", () => {
    it("should throw not found if the user is not found", async () => {
      await expect(controller.delete({ uuid: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw unauthorized if policy does not authorize", async () => {
      const { uuid } = await UserFactory.create();
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.delete({ uuid: uuid! })).rejects.toThrow(UnauthorizedException);
    });

    it("should soft-delete the user and return a JSON:API deleted document", async () => {
      const user = await UserFactory.create();
      policyService.authorize.mockResolvedValue(undefined);
      usersService.delete.mockImplementation(async u => {
        await u.destroy();
      });

      const result = serialize(await controller.delete({ uuid: user.uuid! }));

      expect(policyService.authorize).toHaveBeenCalledWith("delete", expect.objectContaining({ id: user.id }));
      expect(usersService.delete).toHaveBeenCalledWith(expect.objectContaining({ id: user.id }));
      expect(result.meta.resourceType).toBe("users");
      expect(result.meta.resourceIds).toEqual([user.uuid]);

      const reloaded = await User.findOne({ where: { id: user.id }, paranoid: false });
      expect(reloaded?.deletedAt).not.toBeNull();
    });
  });

  describe("userIndex", () => {
    it("authorizes and enriches the document when users are returned", async () => {
      const user = await UserFactory.create();
      const query = { page: { number: 2 } };
      usersService.findMany.mockResolvedValue({ users: [user], paginationTotal: 1 });
      usersService.addUsersToDocument.mockImplementation(async document => document);

      await controller.userIndex(query);

      expect(usersService.findMany).toHaveBeenCalledWith(query);
      expect(policyService.authorize).toHaveBeenCalledWith("read", [user]);
      expect(usersService.addUsersToDocument).toHaveBeenCalledWith(expect.anything(), [user]);
    });

    it("does not authorize when no users are returned", async () => {
      usersService.findMany.mockResolvedValue({ users: [], paginationTotal: 0 });
      usersService.addUsersToDocument.mockImplementation(async document => document);

      await controller.userIndex({});

      expect(policyService.authorize).not.toHaveBeenCalled();
      expect(usersService.addUsersToDocument).toHaveBeenCalledWith(expect.anything(), []);
    });
  });

  describe("update", () => {
    const makeValidBody = (uuid: string, locale?: ValidLocale) => ({
      data: {
        id: uuid,
        type: "users",
        attributes: { locale }
      }
    });

    beforeEach(async () => {
      policyService.authorize.mockResolvedValue(undefined);
    });

    it("should throw if the body and path UUIDs don't match", async () => {
      await expect(controller.update("foo", makeValidBody("bar"))).rejects.toThrow(BadRequestException);
    });

    it("should throw if the user is not found", async () => {
      await expect(controller.update("foo", makeValidBody("foo"))).rejects.toThrow(NotFoundException);
    });

    it("update the user with a new locale", async () => {
      const user = await UserFactory.create();
      const result = serialize(await controller.update(user.uuid!, makeValidBody(user.uuid!, "es-MX")));
      expect((result.data as Resource).attributes.locale).toEqual("es-MX");
      await user.reload();
      expect(user.locale).toEqual("es-MX");
    });

    it("does not change the locale if it's missing in the update request", async () => {
      const user = await UserFactory.create({ locale: "es-MX" });
      const result = serialize(await controller.update(user.uuid!, makeValidBody(user.uuid!)));
      expect((result.data as Resource).attributes.locale).toEqual("es-MX");
      await user.reload();
      expect(user.locale).toEqual("es-MX");
    });
  });

  describe("create", () => {
    it("authorizes creation when request is authenticated", async () => {
      const user = await UserFactory.create();
      const attributes = new UserCreateAttributes();
      mockUserId(1);
      userCreationService.createNewUser.mockResolvedValue(user);

      await controller.create(createRequest(attributes));

      expect(policyService.authorize).toHaveBeenCalledWith("create", User);
      expect(userCreationService.createNewUser).toHaveBeenCalledWith(true, attributes);
    });

    it("does not authorize creation when request is unauthenticated", async () => {
      const user = await UserFactory.create();
      const attributes = new UserCreateAttributes();
      mockUserId();
      userCreationService.createNewUser.mockResolvedValue(user);

      await controller.create(createRequest(attributes));

      expect(policyService.authorize).not.toHaveBeenCalled();
      expect(userCreationService.createNewUser).toHaveBeenCalledWith(false, attributes);
    });

    it("should create a new user", async () => {
      const user = await UserFactory.create();
      const attributes = new UserCreateAttributes();
      attributes.emailAddress = user.emailAddress;
      attributes.firstName = user.firstName!;
      attributes.lastName = user.lastName!;
      userCreationService.createNewUser.mockResolvedValue(user);

      const result = serialize(await controller.create(createRequest(attributes)));
      expect(result).toMatchObject({
        data: {
          id: user.uuid,
          type: "users",
          attributes: {
            uuid: user.uuid,
            emailAddress: attributes.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
      });
    });

    it("should return null when an error occur when trying to create a new user", async () => {
      userCreationService.createNewUser.mockRejectedValue(null);

      await expect(controller.create(createRequest())).rejects.toBeNull();
    });

    it("should throw NotFoundException if Role is not found", async () => {
      userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Role not found"));

      await expect(controller.create(createRequest())).rejects.toThrow(NotFoundException);
    });

    describe("Localizations errors", () => {
      it("should return a error because body localization is not found", async () => {
        userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization body not found"));

        await expect(controller.create(createRequest())).rejects.toThrow(NotFoundException);
      });

      it("should return a error because subject localization is not found", async () => {
        userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization subject not found"));

        await expect(controller.create(createRequest())).rejects.toThrow(NotFoundException);
      });

      it("should return a error because title localization is not found", async () => {
        userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization title not found"));

        await expect(controller.create(createRequest())).rejects.toThrow(NotFoundException);
      });

      it("should return a error because CTA localization is not found", async () => {
        userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization CTA not found"));

        await expect(controller.create(createRequest())).rejects.toThrow(NotFoundException);
      });
    });

    it("should return a error because some error happen", async () => {
      userCreationService.createNewUser.mockRejectedValue(null);

      await expect(controller.create(createRequest())).rejects.toBeNull();
    });

    it("should return a BadRequestException for invalid payload", async () => {
      userCreationService.createNewUser.mockRejectedValue(new BadRequestException("Invalid payload"));

      await expect(controller.create(createRequest())).rejects.toThrow(BadRequestException);
    });

    it("should handle unexpected errors gracefully", async () => {
      userCreationService.createNewUser.mockRejectedValue(new Error("Unexpected error"));

      await expect(controller.create(createRequest())).rejects.toThrow(Error);
    });
  });
});
