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
import { Op } from "sequelize";
import { UserAssociationCreateAttributes } from "./dto/user-association-create.dto";
import crypto from "node:crypto";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

const EMAIL_PROJECT_INVITE_KEYS = {
  body: "v2-project-invite-received-create.body",
  subjectKey: "v2-project-invite-received-create.subject",
  titleKey: "v2-project-invite-received-create.title",
  ctaKey: "v2-project-invite-received-create.cta"
} as const;

const EMAIL_PROJECT_MONITORING_NOTIFICATION_KEYS = {
  body: "v2-project-monitoring-notification.body",
  subjectKey: "v2-project-monitoring-notification.subject",
  titleKey: "v2-project-monitoring-notification.title"
} as const;

@Injectable()
export class UserAssociationService {
  constructor(private readonly emailService: EmailService) {}

  async getUserAssociation(projectId: number) {
    const users = await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
      attributes: ["id", "uuid", "emailAddress"]
    });

    return users;
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
    const users = await User.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ["uuid"] });
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
    this.emailService.sendI18nTemplateEmail(
      newUser.emailAddress,
      newUser.locale as ValidLocale,
      EMAIL_PROJECT_INVITE_KEYS,
      {
        i18nReplacements: {
          "{organisationName}": organisation.name as string,
          "{projectName}": project.name as string,
          "{to}": newUser.emailAddress
        },
        additionalValues: { link: `/reset-password/${token}`, transactional: "transactional" }
      }
    );
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
    this.emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale as ValidLocale,
      EMAIL_PROJECT_MONITORING_NOTIFICATION_KEYS,
      {
        i18nReplacements: {
          "{name}": project.name as string,
          "{callbackUrl}": `/reset-password/${token}`
        }
      }
    );
  }
}
