import { BadRequestException, Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { User } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { UserQueryDto } from "./dto/user-query.dto";
import { UserDto } from "@terramatch-microservices/common/dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

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
      document.addData(user.uuid ?? "no-uuid", new UserDto(user, []));
    }
    return document;
  }
}
