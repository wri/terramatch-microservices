import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  ModelHasRole,
  Notification,
  Organisation,
  OrganisationUser,
  Project,
  ProjectInvite,
  ProjectUser,
  Role,
  User,
  OrganisationInvite,
  PasswordReset
} from "@terramatch-microservices/database/entities";
import { FindOptions, Op, WhereOptions } from "sequelize";
import { UserAssociationCreateAttributes, UserAssociationCreateBody } from "./dto/user-association-create.dto";
import crypto from "node:crypto";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { UserAssociationDto } from "./dto/user-association.dto";
import { UserAssociationQueryDto } from "./dto/user-association-query.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ProjectInviteEmail } from "@terramatch-microservices/common/email/project-invite.email";
import { ProjectMonitoringNotificationEmail } from "@terramatch-microservices/common/email/project-monitoring-notification.email";
import { OrganisationJoinRequestEmail } from "@terramatch-microservices/common/email/organisation-join-request.email";
import { OrganisationUserApprovedEmail } from "@terramatch-microservices/common/email/organisation-user-approved.email";
import { OrganisationUserRejectedEmail } from "@terramatch-microservices/common/email/organisation-user-rejected.email";
import { OrganisationInviteEmail } from "@terramatch-microservices/common/email/organisation-invite.email";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { keyBy } from "lodash";

export const USER_ASSOCIATION_MODELS = ["projects", "organisations"] as const;
export type AssociableModel = (typeof USER_ASSOCIATION_MODELS)[number];

export interface UserAssociationProcessor {
  getEntity(): Promise<Project | Organisation>;
  readonly readPolicy: string;
  readonly createPolicy: string;
  readonly updatePolicy: string;
  readonly approveRejectPolicy: string;
  addDtos(document: DocumentBuilder, query: UserAssociationQueryDto): Promise<void>;
  handleCreate(document: DocumentBuilder, body: UserAssociationCreateBody | undefined, userId: number): Promise<void>;
  handleDelete(uuids: string[]): Promise<void>;
  handleUpdate(document: DocumentBuilder, userUuid: string, status: "approved" | "rejected"): Promise<void>;
}

@Injectable()
export class UserAssociationService {
  private readonly logger = new TMLogger(UserAssociationService.name);

  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  createProcessor(model: AssociableModel, uuid: string): UserAssociationProcessor {
    let _entity: Project | Organisation | null = null;
    const loadEntity = async (): Promise<Project | Organisation> => {
      if (_entity != null) return _entity;
      if (model === "projects") {
        const project = await Project.findOne({
          where: { uuid },
          attributes: ["id", "uuid", "frameworkKey", "organisationId"]
        });
        if (project == null) throw new NotFoundException("Project not found");
        return (_entity = project);
      }
      const organisation = await Organisation.findOne({
        where: { uuid },
        attributes: ["id", "uuid", "name"]
      });
      if (organisation == null) throw new NotFoundException("Organisation not found");
      return (_entity = organisation);
    };

    if (model === "projects") {
      return {
        getEntity: loadEntity,
        readPolicy: "read",
        createPolicy: "update",
        updatePolicy: "update",
        approveRejectPolicy: "update",
        addDtos: async (document, query) => {
          const project = (await loadEntity()) as Project;
          const projectUsers = await this.query(project, query);
          await this.addIndex(document, project, projectUsers, query);
        },
        handleCreate: async (document, body) => {
          if (body == null) throw new BadRequestException("Request body is required for project associations");
          const project = (await loadEntity()) as Project;
          const userAssociation = await this.createUserAssociation(project, body.data.attributes);
          if (userAssociation != null) {
            document.addData(userAssociation.uuid as string, new UserAssociationDto(userAssociation));
          }
        },
        handleDelete: async uuids => {
          const project = (await loadEntity()) as Project;
          await this.deleteBulkUserAssociations(project.id, uuids);
        },
        handleUpdate: async () => {
          throw new BadRequestException("Update status is not supported for projects");
        }
      };
    }

    return {
      getEntity: loadEntity,
      readPolicy: "read",
      createPolicy: "joinRequest",
      updatePolicy: "update",
      approveRejectPolicy: "approveReject",
      addDtos: async (document, query) => {
        const org = (await loadEntity()) as Organisation;
        const orgUsers = await this.queryOrg(org, query);
        await this.addOrgUserDtos(document, org, orgUsers, query);
      },
      handleCreate: async (document, _body, userId) => {
        const org = (await loadEntity()) as Organisation;
        await this.requestOrgJoin(org, userId);
        const user = await User.findOne({
          where: { id: userId },
          attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "phoneNumber", "jobRole"],
          include: [{ association: "roles", attributes: ["name"] }]
        });
        if (user == null) throw new UnauthorizedException("Authenticated user not found");
        document.addData(
          user.uuid as string,
          new UserAssociationDto(user, {
            status: "requested",
            isManager: false,
            organisationName: (org as Organisation).name ?? "",
            roleName: user.primaryRole ?? null,
            associatedType: "organisations"
          })
        );
      },
      handleDelete: async uuids => {
        const org = (await loadEntity()) as Organisation;
        await this.deleteBulkOrgUserAssociations(org.id, uuids);
      },
      handleUpdate: async (document, userUuid, status) => {
        const org = (await loadEntity()) as Organisation;
        const user = await this.updateOrgUserStatus(org, userUuid, status);
        document.addData(
          user.uuid as string,
          new UserAssociationDto(user, {
            status,
            isManager: false,
            organisationName: org.name ?? "",
            roleName: user.primaryRole ?? null,
            associatedType: "organisations"
          })
        );
      }
    };
  }

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
      attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "organisationId", "phoneNumber", "jobRole"],
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const organisationIds = users.map(user => user.organisationId).filter(isNotNull);
    const organisations = await Organisation.findAll({
      where: { id: { [Op.in]: organisationIds } },
      attributes: ["id", "name"]
    });
    const organisationMap = keyBy(
      organisations.map(organisation => organisation.dataValues),
      "id"
    );
    users.forEach(user => {
      const projectUser = projectUsers.find(projectUser => projectUser.userId === user.id);
      const organisation = organisationMap[user.organisationId as number];
      document.addData(
        user.uuid as string,
        new UserAssociationDto(user, {
          status: projectUser?.status as string,
          isManager: projectUser?.isManaging as boolean,
          organisationName: organisation?.name as string,
          roleName: user.primaryRole as string,
          associatedType: "projects"
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
      attributes: ["id", "emailAddress"],
      include: [{ association: "roles", attributes: ["name"] }]
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
    if (users.length === 0) throw new NotFoundException("Users not found");
    const userIds = users.map(user => user.id);
    await ProjectUser.destroy({ where: { projectId, userId: { [Op.in]: userIds } } });
    await ProjectInvite.destroy({
      where: { projectId, emailAddress: { [Op.in]: users.map(user => user.emailAddress) } }
    });
    return users.map(user => user.uuid);
  }

  private async handleUserNotFound(project: Project, attributes: UserAssociationCreateAttributes) {
    if (attributes.isManager) throw new NotFoundException("User not found");
    const newUser = await User.create({
      organisationId: project.organisationId,
      emailAddress: attributes.emailAddress,
      password: crypto.randomBytes(32).toString("hex"),
      locale: "en-US"
    } as User);
    const pdRole = (await Role.findOne({ where: { name: "project-developer" } })) as Role;
    await ModelHasRole.create({ modelId: newUser.id, roleId: pdRole.id, modelType: User.LARAVEL_TYPE });
    const token = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({ userId: newUser.id, token });
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: attributes.emailAddress,
      token
    } as ProjectInvite);
    const organisation = await Organisation.findOne({
      where: { id: project.organisationId as number },
      attributes: ["name"]
    });
    if (organisation == null) throw new NotFoundException("Organisation not found");
    await new ProjectInviteEmail({
      projectId: project.id,
      emailAddress: newUser.emailAddress,
      token
    }).sendLater(this.emailQueue);
    return newUser;
  }

  queryOrg(organisation: Organisation, query: UserAssociationQueryDto) {
    const findOptions: FindOptions<OrganisationUser> = {
      where: { organisationId: organisation.id },
      attributes: ["id", "userId", "status"]
    };
    if (query.status != null) {
      (findOptions.where as WhereOptions<OrganisationUser>)["status"] = query.status;
    }
    return OrganisationUser.findAll(findOptions);
  }

  async addOrgUserDtos(
    document: DocumentBuilder,
    organisation: Organisation,
    orgUsers: OrganisationUser[],
    query: UserAssociationQueryDto
  ) {
    const partnerUserIds = orgUsers.map(orgUser => orgUser.userId);
    const includeOwners = query.status == null || query.status === "approved";

    let userIds = [...partnerUserIds];
    if (includeOwners) {
      const owners = await User.findAll({
        where: { organisationId: organisation.id },
        attributes: ["id"]
      });
      const ownerIds = owners.map(owner => owner.id);
      userIds = [...new Set([...userIds, ...ownerIds])];
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
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
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const filteredUsers = includeOwners ? users : users.filter(user => user.organisationId !== organisation.id);
    filteredUsers.forEach(user => {
      const orgUser = orgUsers.find(orgUser => orgUser.userId === user.id);
      const isOwner = user.organisationId === organisation.id;
      const status = isOwner ? "approved" : orgUser?.status ?? "";
      const dto = new UserAssociationDto(user, {
        status,
        isManager: false,
        organisationName: organisation.name ?? "",
        roleName: user.primaryRole ?? null,
        associatedType: "organisations"
      });
      dto.lastLoggedInAt = user.lastLoggedInAt != null ? user.lastLoggedInAt.toISOString() : null;
      document.addData(user.uuid as string, dto);
    });
    const indexIds = filteredUsers.map(user => user.uuid as string);
    document.addIndex({
      resource: "associatedUsers",
      requestPath: `/userAssociations/v3/organisations/${organisation.uuid}${getStableRequestQuery(query)}`,
      total: filteredUsers.length,
      ids: indexIds
    });
  }

  async deleteBulkOrgUserAssociations(organisationId: number, uuids: string[]) {
    const users = await User.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["id", "uuid", "emailAddress"]
    });
    if (users.length === 0) throw new NotFoundException("Users not found");
    const userIds = users.map(user => user.id);
    await OrganisationUser.destroy({ where: { organisationId, userId: { [Op.in]: userIds } } });
    return users.map(user => user.uuid);
  }

  async inviteOrganisationUser(
    organisation: Organisation,
    emailAddress: string,
    callbackUrl?: string | null
  ): Promise<OrganisationInvite> {
    const existingUser = await User.findOne({
      where: { emailAddress },
      attributes: ["id"]
    });
    if (existingUser != null) {
      throw new UnprocessableEntityException("A user with this email address already exists");
    }

    const newUser = await User.create({
      organisationId: organisation.id,
      emailAddress,
      password: crypto.randomBytes(32).toString("hex"),
      locale: "en-US"
    } as User);

    const pdRole = (await Role.findOne({ where: { name: "project-developer" } })) as Role;
    await ModelHasRole.create({ modelId: newUser.id, roleId: pdRole.id, modelType: User.LARAVEL_TYPE });

    const token = crypto.randomBytes(32).toString("hex");
    const invite = await OrganisationInvite.create({
      organisationId: organisation.id,
      emailAddress,
      token
    } as OrganisationInvite);
    await PasswordReset.create({ userId: newUser.id, token });
    try {
      await new OrganisationInviteEmail({
        organisationId: organisation.id,
        emailAddress,
        token,
        callbackUrl
      }).sendLater(this.emailQueue);
    } catch (error) {
      this.logger.error(
        `Failed to queue organisation invite email for organisation ${organisation.id} and email ${emailAddress}`,
        error
      );
    }

    return invite;
  }

  async requestOrgJoin(organisation: Organisation, userId: number): Promise<User> {
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "uuid", "emailAddress"]
    });
    if (user == null) throw new UnauthorizedException("Authenticated user not found");

    const [orgUser, created] = await OrganisationUser.findOrCreate({
      where: { organisationId: organisation.id, userId },
      defaults: { organisationId: organisation.id, userId, status: "requested" } as OrganisationUser
    });
    if (!created && orgUser.status !== "requested") {
      orgUser.status = "requested";
      await orgUser.save();
    }

    const owners = await User.findAll({ where: { organisationId: organisation.id }, attributes: ["id"] });
    if (owners.length > 0) {
      await Notification.bulkCreate(
        owners.map(owner => ({
          userId: owner.id,
          title: "A user has requested to join your organization",
          body: "A user has requested to join your organization. Please go to the 'Meet the Team' page to review this request.",
          action: "user_join_organisation_requested",
          referencedModel: Organisation.LARAVEL_TYPE,
          referencedModelId: organisation.id
        }))
      );
    }

    try {
      await new OrganisationJoinRequestEmail({
        organisationId: organisation.id,
        requestingUserId: userId
      }).sendLater(this.emailQueue);
    } catch (error) {
      this.logger.error(`Failed to queue organisation join request email for organisation ${organisation.id}`, error);
    }

    return user;
  }

  async updateOrgUserStatus(
    organisation: Organisation,
    userUuid: string,
    status: "approved" | "rejected"
  ): Promise<User> {
    const user = await User.findOne({
      where: { uuid: userUuid },
      attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "organisationId", "phoneNumber", "jobRole"],
      include: [{ association: "roles", attributes: ["name"] }]
    });

    if (user == null) {
      throw new NotFoundException(`User with UUID ${userUuid} not found`);
    }

    const orgUser = await OrganisationUser.findOne({
      where: { organisationId: organisation.id, userId: user.id }
    });

    if (orgUser == null) {
      throw new BadRequestException("User does not have a relationship with this organisation");
    }

    const allowedFrom = status === "approved" ? ["requested", "rejected"] : ["requested"];
    if (!allowedFrom.includes(orgUser.status ?? "")) {
      throw new BadRequestException(`Cannot ${status} a user with status '${orgUser.status}'`);
    }

    orgUser.status = status;
    await orgUser.save();

    if (status === "approved") {
      user.organisationId = organisation.id;
      await user.save();
    }

    try {
      if (status === "approved") {
        await new OrganisationUserApprovedEmail({
          organisationId: organisation.id,
          userId: user.id
        }).sendLater(this.emailQueue);
      } else {
        await new OrganisationUserRejectedEmail({
          organisationId: organisation.id,
          userId: user.id
        }).sendLater(this.emailQueue);
      }
    } catch (error) {
      this.logger.error(
        `Failed to queue organisation user ${status} email for user ${user.id} in organisation ${organisation.id}`,
        error
      );
    }

    return user;
  }

  private async handleExistingUser(project: Project, user: User, attributes: UserAssociationCreateAttributes) {
    if (attributes.isManager) {
      if (user.primaryRole !== "project-manager") throw new BadRequestException("User is not a project manager");
      const projectUser = await ProjectUser.findOne({
        where: { projectId: project.id, userId: user.id, isManaging: true }
      });
      if (projectUser != null) throw new BadRequestException("User is already a project manager");
      await ProjectUser.create({ projectId: project.id, userId: user.id, isManaging: true });
      return;
    }

    const projectUser = await ProjectUser.findOne({ where: { projectId: project.id, userId: user.id } });
    if (projectUser == null) {
      await ProjectUser.create({ projectId: project.id, userId: user.id, isMonitoring: true, status: "active" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: user.emailAddress,
      acceptedAt: new Date(),
      token
    } as ProjectInvite);

    await new ProjectMonitoringNotificationEmail({
      projectId: project.id,
      userId: user.id
    }).sendLater(this.emailQueue);
  }

  async acceptProjectInvite(
    token: string,
    userId: number
  ): Promise<{ user: User; project: Project; invite: ProjectInvite }> {
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "organisationId", "phoneNumber", "jobRole"],
      include: [{ association: "roles", attributes: ["name"] }]
    });

    if (user == null) {
      throw new UnauthorizedException("Authenticated user not found");
    }

    const invite = await ProjectInvite.findOne({
      where: { token, emailAddress: user.emailAddress },
      include: [{ association: "project", attributes: ["id", "uuid", "name", "organisationId"] }]
    });

    if (invite == null) {
      throw new NotFoundException("Project invite not found");
    }

    if (invite.acceptedAt != null) {
      throw new BadRequestException("Project invite has already been accepted");
    }

    const project = invite.project;
    if (project == null) {
      throw new NotFoundException("Project associated with invite not found");
    }

    const [projectUser, created] = await ProjectUser.findOrCreate({
      where: { projectId: project.id, userId: user.id },
      defaults: {
        projectId: project.id,
        userId: user.id,
        isMonitoring: true,
        status: "active"
      }
    });

    if (!created) {
      projectUser.isMonitoring = true;
      if (projectUser.status == null) {
        projectUser.status = "active";
      }
      await projectUser.save();
    }

    invite.acceptedAt = new Date();
    await invite.save();

    return { user, project, invite };
  }
}
