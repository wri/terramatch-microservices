import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";
import { Framework, FrameworkUser, ModelHasRole, Role, User } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { UserQueryDto } from "./dto/user-query.dto";
import { UserDto } from "@terramatch-microservices/common/dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { UserUpdateAttributes } from "./dto/user-update.dto";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { Organisation } from "@terramatch-microservices/database/entities/organisation.entity";

@Injectable()
export class UsersService {
  async findMany(query: UserQueryDto) {
    const includes = [
      {
        association: "organisation",
        attributes: ["id", "uuid", "name"]
      },
      {
        association: "roles",
        attributes: ["name"]
      }
    ];

    const builder = PaginatedQueryBuilder.forNumberPage(User, query.page, includes);

    if (query.search != null && query.search.trim() !== "") {
      const search = `%${query.search.trim()}%`;
      builder.where({
        [Op.or]: [
          { emailAddress: { [Op.like]: search } },
          { firstName: { [Op.like]: search } },
          { lastName: { [Op.like]: search } },
          { "$organisation.name$": { [Op.like]: search } }
        ]
      });
    }

    if (query.isVerified != null) {
      builder.where({
        emailAddressVerifiedAt: {
          [query.isVerified ? Op.ne : Op.eq]: null
        }
      });
    }

    if (query.sort?.field != null) {
      const sortField = query.sort.field;
      const direction = query.sort.direction ?? "DESC";

      const directFields = ["createdAt", "firstName", "lastName", "emailAddress", "lastLoggedInAt"];

      if (directFields.includes(sortField)) {
        builder.order([sortField, direction]);
      } else if (sortField === "organisationName") {
        builder.order(["organisation", "name", direction]);
      } else if (sortField !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    } else {
      builder.order(["createdAt", "DESC"]);
    }

    return {
      users: await builder.execute(),
      paginationTotal: await builder.paginationTotal()
    };
  }

  async addUsersToDocument(document: DocumentBuilder, users: User[]) {
    for (const user of users) {
      document.addData(user.uuid ?? "no-uuid", new UserDto(user, [], []));
    }
    return document;
  }

  async update(user: User, update: UserUpdateAttributes) {
    if (update.organisationUuid != null) {
      const organisation = await Organisation.findOne({ where: { uuid: update.organisationUuid } });
      if (organisation == null) {
        throw new NotFoundException("Organisation not found");
      }
      user.organisationId = organisation.id;
    }
    if (update.firstName != null) {
      user.firstName = update.firstName ?? null;
    }
    if (update.lastName != null) {
      user.lastName = update.lastName ?? null;
    }
    if (update.emailAddress != null) {
      user.emailAddress = update.emailAddress ?? null;
    }
    if (update.jobRole != null) {
      user.jobRole = update.jobRole ?? null;
    }
    if (update.phoneNumber != null) {
      user.phoneNumber = update.phoneNumber ?? null;
    }
    if (update.country != null) {
      user.country = update.country ?? null;
    }
    if (update.program != null) {
      user.program = update.program ?? null;
    }
    if (update.locale != null) {
      user.locale = update.locale as ValidLocale;
    }
    if (update.directFrameworks != null) {
      await FrameworkUser.destroy({ where: { userId: user.id } });
      for (const framework of update.directFrameworks ?? []) {
        const frameworkEntity = await Framework.findOne({ where: { slug: framework } });
        if (frameworkEntity == null) {
          throw new NotFoundException("Framework not found");
        }
        await FrameworkUser.findOrCreate({
          where: { frameworkId: frameworkEntity.id, userId: user.id }
        });
      }
    }
    user = await user.save();
    if (update.primaryRole != null) {
      await ModelHasRole.destroy({ where: { modelId: user.id, modelType: User.LARAVEL_TYPE } });
      const roleEntity = await Role.findOne({ where: { name: update.primaryRole } });
      if (roleEntity == null) {
        throw new NotFoundException("Role not found");
      }
      await ModelHasRole.findOrCreate({
        where: { modelId: user.id, roleId: roleEntity.id },
        defaults: { modelId: user.id, roleId: roleEntity.id, modelType: User.LARAVEL_TYPE } as ModelHasRole
      });
      await user.reload();
    }
    return user;
  }

  async delete(user: User): Promise<void> {
    await user.destroy();
  }
}
