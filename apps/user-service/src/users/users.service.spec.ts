import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";
import { UsersService } from "./users.service";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import {
  Framework,
  FrameworkUser,
  ModelHasRole,
  Organisation,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { UserQueryDto } from "./dto/user-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { UserUpdateAttributes } from "./dto/user-update.dto";
import bcrypt from "bcryptjs";

describe("UsersService", () => {
  let service: UsersService;

  const createBuilderMock = () => ({
    where: jest.fn(),
    order: jest.fn(),
    execute: jest.fn().mockResolvedValue([{ id: 1 }]),
    paginationTotal: jest.fn().mockResolvedValue(42)
  });

  beforeEach(() => {
    service = new UsersService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findMany", () => {
    it("should return users and pagination total", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      const query = { page: 1 } as UserQueryDto;
      const result = await service.findMany(query);

      expect(PaginatedQueryBuilder.forNumberPage).toHaveBeenCalledWith(
        User,
        query.page,
        expect.arrayContaining([
          expect.objectContaining({ association: "organisation" }),
          expect.objectContaining({ association: "roles" })
        ])
      );
      expect(builder.order).toHaveBeenCalledWith(["createdAt", "DESC"]);
      expect(result).toEqual({
        users: [{ id: 1 }],
        paginationTotal: 42
      });
    });

    it("should apply search filter when search is provided", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({ page: 1, search: "  john  " } as UserQueryDto);

      expect(builder.where).toHaveBeenCalledWith({
        [Op.or]: [
          { emailAddress: { [Op.like]: "%john%" } },
          { firstName: { [Op.like]: "%john%" } },
          { lastName: { [Op.like]: "%john%" } }
        ]
      });
    });

    it("should ignore blank search values", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({ page: 1, search: "   " } as UserQueryDto);

      expect(builder.where).not.toHaveBeenCalledWith(
        expect.objectContaining({
          [Op.or]: expect.anything()
        })
      );
    });

    it("should filter verified users when isVerified is true", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({ page: 1, isVerified: true } as UserQueryDto);

      expect(builder.where).toHaveBeenCalledWith({
        emailAddressVerifiedAt: {
          [Op.ne]: null
        }
      });
    });

    it("should filter unverified users when isVerified is false", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({ page: 1, isVerified: false } as UserQueryDto);

      expect(builder.where).toHaveBeenCalledWith({
        emailAddressVerifiedAt: {
          [Op.eq]: null
        }
      });
    });

    it("should sort by direct fields", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({
        page: 1,
        sort: { field: "firstName", direction: "ASC" }
      } as UserQueryDto);

      expect(builder.order).toHaveBeenCalledWith(["firstName", "ASC"]);
    });

    it("should sort by organisation name", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({
        page: 1,
        sort: { field: "organisationName", direction: "DESC" }
      } as UserQueryDto);

      expect(builder.order).toHaveBeenCalledWith(["organisation", "name", "DESC"]);
    });

    it("should default sort direction to DESC when direction is missing", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({
        page: 1,
        sort: { field: "emailAddress" }
      } as UserQueryDto);

      expect(builder.order).toHaveBeenCalledWith(["emailAddress", "DESC"]);
    });

    it("should allow id sort field without adding explicit order", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await service.findMany({
        page: 1,
        sort: { field: "id", direction: "ASC" }
      } as UserQueryDto);

      expect(builder.order).not.toHaveBeenCalled();
    });

    it("should throw for invalid sort field", async () => {
      const builder = createBuilderMock();
      jest.spyOn(PaginatedQueryBuilder, "forNumberPage").mockReturnValue(builder as never);

      await expect(
        service.findMany({
          page: 1,
          sort: { field: "invalidField", direction: "ASC" }
        } as UserQueryDto)
      ).rejects.toThrow(new BadRequestException("Invalid sort field: invalidField"));
    });
  });

  describe("addUsersToDocument", () => {
    it("should add each user with uuid key", async () => {
      const document = {
        addData: jest.fn()
      } as unknown as DocumentBuilder;

      const users = [{ uuid: "user-1" } as User, { uuid: "user-2" } as User];

      const result = await service.addUsersToDocument(document, users);

      expect(document.addData).toHaveBeenNthCalledWith(1, "user-1", expect.anything());
      expect(document.addData).toHaveBeenNthCalledWith(2, "user-2", expect.anything());
      expect(result).toBe(document);
    });

    it('should use "no-uuid" when user uuid is missing', async () => {
      const document = {
        addData: jest.fn()
      } as unknown as DocumentBuilder;

      const users = [{ uuid: null } as unknown as User];
      await service.addUsersToDocument(document, users);

      expect(document.addData).toHaveBeenCalledWith("no-uuid", expect.anything());
    });
  });

  describe("update", () => {
    const createUserMock = () => {
      const user = {
        id: 99,
        frameworks: [] as Framework[],
        organisationId: null as number | null,
        firstName: "Old",
        lastName: "Name",
        emailAddress: "old@example.com",
        jobRole: "old-job" as string | null,
        phoneNumber: "111" as string | null,
        country: "US" as string | null,
        program: "p1" as string | null,
        locale: "en-US" as const,
        save: jest.fn(),
        reload: jest.fn()
      };
      user.save.mockResolvedValue(user);
      user.reload.mockResolvedValue(user);
      return user as unknown as User;
    };

    it("should persist scalar field changes and return the user", async () => {
      const user = createUserMock();
      const update: UserUpdateAttributes = {
        firstName: "New",
        lastName: "Person",
        emailAddress: "new@example.com",
        jobRole: "engineer",
        phoneNumber: "555",
        country: "CA",
        program: "p2",
        locale: "fr-FR"
      };

      const result = await service.update(user, update);

      expect(user.firstName).toBe("New");
      expect(user.lastName).toBe("Person");
      expect(user.emailAddress).toBe("new@example.com");
      expect(user.jobRole).toBe("engineer");
      expect(user.phoneNumber).toBe("555");
      expect(user.country).toBe("CA");
      expect(user.program).toBe("p2");
      expect(user.locale).toBe("fr-FR");
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(user);
    });

    it("should throw when organisation uuid does not exist", async () => {
      const user = createUserMock();
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(service.update(user, { organisationUuid: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow(
        new NotFoundException("Organisation not found")
      );

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: "00000000-0000-0000-0000-000000000001" }
      });
      expect(user.save).not.toHaveBeenCalled();
    });

    it("should set organisationId when organisation exists", async () => {
      const user = createUserMock();
      jest.spyOn(Organisation, "findOne").mockResolvedValue({ id: 7 } as Organisation);

      await service.update(user, { organisationUuid: "org-uuid" });

      expect(user.organisationId).toBe(7);
      expect(user.save).toHaveBeenCalled();
    });

    it("should replace direct frameworks when directFrameworks is provided", async () => {
      const user = createUserMock();
      jest.spyOn(FrameworkUser, "destroy").mockResolvedValue(0);
      jest.spyOn(Framework, "findAll").mockResolvedValue([{ id: 10 } as Framework, { id: 20 } as Framework]);
      const findOrCreateSpy = jest.spyOn(FrameworkUser, "findOrCreate").mockResolvedValue([{} as FrameworkUser, true]);

      await service.update(user, { directFrameworks: ["fw-a", "fw-b"] });

      expect(Framework.findAll).toHaveBeenCalledWith({ where: { slug: ["fw-a", "fw-b"] } });
      expect(findOrCreateSpy).toHaveBeenNthCalledWith(1, {
        where: { frameworkId: 10, userId: 99 }
      });
      expect(findOrCreateSpy).toHaveBeenNthCalledWith(2, {
        where: { frameworkId: 20, userId: 99 }
      });
    });

    it("should throw when a direct framework slug is unknown", async () => {
      const user = createUserMock();
      jest.spyOn(Framework, "findAll").mockResolvedValue([]);

      await expect(service.update(user, { directFrameworks: ["missing"] })).rejects.toThrow(
        new BadRequestException("One or more frameworks not found")
      );
    });

    it("should replace primary role when primaryRole is provided", async () => {
      const user = createUserMock();
      const destroySpy = jest.spyOn(ModelHasRole, "destroy").mockResolvedValue(0);
      jest.spyOn(Role, "findOne").mockResolvedValue({ id: 5 } as Role);
      const findOrCreateSpy = jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);

      const result = await service.update(user, { primaryRole: "admin" });

      expect(destroySpy).toHaveBeenCalledWith({
        where: { modelId: 99, modelType: User.LARAVEL_TYPE }
      });
      expect(Role.findOne).toHaveBeenCalledWith({ where: { name: "admin" } });
      expect(findOrCreateSpy).toHaveBeenCalledWith({
        where: { modelId: 99, roleId: 5 },
        defaults: { modelId: 99, roleId: 5, modelType: User.LARAVEL_TYPE } as ModelHasRole
      });
      expect(user.reload).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it("should throw when primary role does not exist", async () => {
      const user = createUserMock();
      jest.spyOn(ModelHasRole, "destroy").mockResolvedValue(0);
      jest.spyOn(Role, "findOne").mockResolvedValue(null);

      await expect(service.update(user, { primaryRole: "unknown-role" })).rejects.toThrow(
        new NotFoundException("Role not found")
      );
    });

    it("should update password when password is provided", async () => {
      const user = createUserMock();
      const update = { password: "new-password" };
      (jest.spyOn(bcrypt, "hash") as unknown as jest.SpyInstance<Promise<string>>).mockResolvedValue("hashed-password");

      const result = await service.update(user, update);

      expect(result.password).toBe("hashed-password");
    });
  });

  describe("delete", () => {
    it("should call destroy on the given user", async () => {
      const user = {
        destroy: jest.fn().mockResolvedValue(undefined)
      } as unknown as User;

      await service.delete(user);

      expect(user.destroy).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors thrown by destroy", async () => {
      const destroyError = new Error("delete failed");
      const user = {
        destroy: jest.fn().mockRejectedValue(destroyError)
      } as unknown as User;

      await expect(service.delete(user)).rejects.toThrow(destroyError);
      expect(user.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
