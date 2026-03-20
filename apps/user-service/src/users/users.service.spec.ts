import { BadRequestException } from "@nestjs/common";
import { Op } from "sequelize";
import { UsersService } from "./users.service";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { User } from "@terramatch-microservices/database/entities";
import { UserQueryDto } from "./dto/user-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

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
          { lastName: { [Op.like]: "%john%" } },
          { "$organisation.name$": { [Op.like]: "%john%" } }
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
});
