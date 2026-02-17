import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ModelHasRole,
  Organisation,
  Project,
  ProjectInvite,
  ProjectUser,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { FindOptions, Op, WhereOptions } from "sequelize";
import { UserAssociationCreateAttributes } from "./dto/user-association-create.dto";
import crypto from "node:crypto";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { UserAssociationDto } from "./dto/user-association.dto";
import { UserAssociationQueryDto } from "./dto/user-association-query.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ProjectInviteEmail } from "@terramatch-microservices/common/email/project-invite.email";
import { ProjectMonitoringNotificationEmail } from "@terramatch-microservices/common/email/project-monitoring-notification.email";

@Injectable()
export class UserAssociationService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  query(project: Project, query: UserAssociationQueryDto) {
    const findOptions: FindOptions<ProjectUser> = {
      where: { projectId: project.id },
      attributes: ["id", "userId", "status", "isMonitoring", "isManaging"]
    };
    if (query.isManager != null) {
      if (query.isManager === true) {
        (findOptions.where as WhereOptions<ProjectUser>)["isManaging"] = true;
      } else {
        (findOptions.where as WhereOptions<ProjectUser>)["isMonitoring"] = true;
      }
    }
    return ProjectUser.findAll(findOptions);
  }

  async addIndex(
    document: DocumentBuilder,
    project: Project,
    projectUsers: ProjectUser[],
    query: UserAssociationQueryDto
  ) {
    const projectUsersData = projectUsers.map(projectUser => projectUser.dataValues);
    const users = await User.findAll({
      where: { id: { [Op.in]: projectUsersData.map(projectUser => projectUser.userId) } },
      attributes: ["id", "uuid", "emailAddress", "firstName", "lastName"]
    });
    users.forEach(user => {
      const projectUser = projectUsers.find(projectUser => projectUser.userId === user.id);
      document.addData(
        user.uuid as string,
        new UserAssociationDto(user, {
          status: projectUser?.status as string,
          isManager: projectUser?.isManaging as boolean
        })
      );
    });
    const indexIds = users.map(user => user.uuid as string);
    document.addIndex({
      resource: "associatedUsers",
      requestPath: `/userAssociations/v3/projects/${project.uuid}${getStableRequestQuery(query)}`,
      total: users.length,
      ids: indexIds
    });
  }

  async createUserAssociation(project: Project, attributes: UserAssociationCreateAttributes) {
    const user = await User.findOne({
      where: { emailAddress: attributes.emailAddress },
      attributes: ["id", "emailAddress"]
    });

    if (user == null) {
      return this.handleUserNotFound(project, attributes);
    } else {
      await this.handleExistingUser(project, user, attributes);
      return user;
    }
  }

  async deleteBulkUserAssociations(projectId: number, uuids: string[]) {
    const users = await User.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["id", "uuid", "emailAddress"]
    });
    if (users.length === 0) {
      throw new NotFoundException("Users not found");
    }
    const userIds = users.map(user => user.id);
    await ProjectUser.destroy({ where: { projectId, userId: { [Op.in]: userIds } } });
    await ProjectInvite.destroy({
      where: { projectId, emailAddress: { [Op.in]: users.map(user => user.emailAddress) } }
    });
    return users.map(user => user.uuid);
  }

  private async handleUserNotFound(project: Project, attributes: UserAssociationCreateAttributes) {
    if (attributes.isManager) {
      throw new NotFoundException("User not found");
    }
    const newUser = await User.create({
      organisationId: project.organisationId,
      emailAddress: attributes.emailAddress,
      password: crypto.randomBytes(32).toString("hex"),
      locale: "en-US"
    } as User);
    const pdRole = (await Role.findOne({ where: { name: "project-developer" } })) as Role;
    await ModelHasRole.create({
      modelId: newUser.id,
      roleId: pdRole.id,
      modelType: User.LARAVEL_TYPE
    } as ModelHasRole);
    const token = crypto.randomBytes(32).toString("hex");
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: attributes.emailAddress,
      token
    } as ProjectInvite);
    const organisation = await Organisation.findOne({
      where: { id: project.organisationId as number },
      attributes: ["name"]
    });
    if (organisation == null) {
      throw new NotFoundException("Organisation not found");
    }
    await new ProjectInviteEmail({
      projectId: project.id,
      emailAddress: newUser.emailAddress,
      token
    }).sendLater(this.emailQueue);
    return newUser;
  }

  private async handleExistingUser(project: Project, user: User, attributes: UserAssociationCreateAttributes) {
    if (attributes.isManager) {
      const projectUser = await ProjectUser.findOne({
        where: { projectId: project.id, userId: user.id, isManaging: true }
      });

      if (projectUser != null) {
        throw new BadRequestException("User is already a project manager");
      }
    }
    const projectUser = await ProjectUser.findOne({
      where: { projectId: project.id, userId: user.id }
    });
    if (projectUser == null) {
      await ProjectUser.create({
        projectId: project.id,
        userId: user.id,
        isMonitoring: true
      });
    }
    const token = crypto.randomBytes(32).toString("hex");
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: user.emailAddress,
      token,
      acceptedAt: new Date()
    } as ProjectInvite);
    await new ProjectMonitoringNotificationEmail({
      projectId: project.id,
      userId: user.id,
      token
    }).sendLater(this.emailQueue);
  }
}
