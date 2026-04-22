import bcrypt from "bcryptjs";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import {
  Framework,
  FrameworkUser,
  ModelHasRole,
  Project,
  ProjectUser,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { UserQueryDto } from "./dto/user-query.dto";
import { UserDto, UserMonitoringPartnerProjectDto } from "@terramatch-microservices/common/dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { UserUpdateAttributes } from "./dto/user-update.dto";
import { Organisation } from "@terramatch-microservices/database/entities/organisation.entity";

@Injectable()
export class UsersService {
  /**
   * Projects linked via v2_project_users with is_monitoring = true.
   */
  async getMonitoringPartnerProjects(user: User): Promise<UserMonitoringPartnerProjectDto[]> {
    const links = await ProjectUser.findAll({
      where: { userId: user.id, isMonitoring: true },
      attributes: ["projectId"]
    });
    if (links.length === 0) {
      return [];
    }
    const projects = await Project.findAll({
      where: { id: { [Op.in]: links.map(link => link.projectId) } },
      attributes: ["uuid", "name"],
      order: [["name", "ASC"]]
    });
    const summaries: UserMonitoringPartnerProjectDto[] = [];
    for (const project of projects) {
      if (project.uuid != null) {
        summaries.push({ uuid: project.uuid, name: project.name });
      }
    }
    return summaries;
  }

  async findMany(query: UserQueryDto) {
    const includes = [
      {
        association: "organisation",
        attributes: ["id", "uuid", "name"]
      },
      {
        association: "roles",
        attributes: ["name"]
      },
      {
        association: "frameworks",
        attributes: ["id", "name", "slug"]
      }
    ];

    const builder = PaginatedQueryBuilder.forNumberPage(User, query.page, includes);

    if (query.search != null && query.search.trim() !== "") {
      const search = `%${query.search.trim()}%`;
      builder.where({
        [Op.or]: [
          { emailAddress: { [Op.like]: search } },
          { firstName: { [Op.like]: search } },
          { lastName: { [Op.like]: search } }
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

      const directFields = [
        "createdAt",
        "firstName",
        "lastName",
        "emailAddress",
        "lastLoggedInAt",
        "emailAddressVerifiedAt"
      ];

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
      const userFrameworks = typeof user.myFrameworks === "function" ? await user.myFrameworks() : [];
      document.addData(user.uuid ?? "no-uuid", new UserDto(user, user.frameworks, userFrameworks));
    }
    return document;
  }

  async update(user: User, update: UserUpdateAttributes) {
    let organisationEntity: Organisation | null = null;
    let frameworkEntities: Framework[] = [];
    let roleEntity: Role | null = null;
    if (update.organisationUuid != null) {
      organisationEntity = await Organisation.findOne({ where: { uuid: update.organisationUuid } });
      if (organisationEntity == null) {
        throw new BadRequestException("Organisation not found");
      }
    }
    if (update.directFrameworks != null) {
      frameworkEntities = await Framework.findAll({ where: { slug: update.directFrameworks } });
      if (frameworkEntities.length !== update.directFrameworks.length) {
        throw new BadRequestException("One or more frameworks not found");
      }
    }
    if (update.primaryRole != null) {
      roleEntity = await Role.findOne({ where: { name: update.primaryRole } });
      if (roleEntity == null) {
        throw new BadRequestException("Role not found");
      }
    }

    if (update.directFrameworks != null) {
      const userPreviousFrameworks = user.frameworks ?? [];
      const frameworksToDelete = userPreviousFrameworks.filter(
        framework => !frameworkEntities.some(entity => entity.id === framework.id)
      );
      const frameworksToAdd = frameworkEntities.filter(
        framework => !userPreviousFrameworks.some(previousFramework => previousFramework.id === framework.id)
      );

      if (frameworksToDelete.length > 0) {
        await FrameworkUser.destroy({
          where: { userId: user.id, frameworkId: { [Op.in]: frameworksToDelete.map(framework => framework.id) } }
        });
      }
      for (const framework of frameworksToAdd) {
        await FrameworkUser.findOrCreate({ where: { userId: user.id, frameworkId: framework.id } });
      }
    }

    if (update.password != null) {
      user.password = await bcrypt.hash(update.password, 10);
    }

    user.organisationId = organisationEntity?.id ?? user.organisationId;
    user.firstName = update.firstName ?? user.firstName;
    user.lastName = update.lastName ?? user.lastName;
    user.emailAddress = update.emailAddress ?? user.emailAddress;
    user.jobRole = update.jobRole ?? user.jobRole;
    user.phoneNumber = update.phoneNumber ?? user.phoneNumber;
    user.country = update.country ?? user.country;
    user.program = update.program ?? user.program;
    user.locale = update.locale ?? user.locale;

    user = await user.save();

    if (roleEntity != null) {
      await ModelHasRole.destroy({ where: { modelId: user.id, modelType: User.LARAVEL_TYPE } });
      await ModelHasRole.findOrCreate({
        where: { modelId: user.id, roleId: roleEntity?.id },
        defaults: { modelId: user.id, roleId: roleEntity?.id, modelType: User.LARAVEL_TYPE } as ModelHasRole
      });
      await user.reload();
    }
    return user;
  }

  async delete(user: User): Promise<void> {
    await user.destroy();
  }
}
