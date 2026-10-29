import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  Organisation,
  OrganisationInvite,
  OrganisationJoinRequest,
  PasswordReset,
  Project,
  ProjectInvite,
  ProjectUser,
  User
} from "@terramatch-microservices/database/entities";
import { FindOptions, Op, WhereAttributeHash, WhereOptions } from "sequelize";
import { UserAssociationCreateAttributes, UserAssociationCreateBody } from "./dto/user-association-create.dto";
import crypto from "node:crypto";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { UserAssociationDto } from "./dto/user-association.dto";
import { UserAssociationQueryDto } from "./dto/user-association-query.dto";
import { OrganisationInviteRequestDto } from "./dto/organisation-invite-request.dto";
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
import { keyBy, uniq } from "lodash";
import {
  APPROVED,
  OrganisationMembershipStatus,
  PENDING,
  REJECTED
} from "@terramatch-microservices/database/constants/status";

export const USER_ASSOCIATION_MODELS = ["projects", "organisations"] as const;
export type AssociableModel = (typeof USER_ASSOCIATION_MODELS)[number];

export interface UserAssociationProcessor {
  getEntity(): Promise<Project | Organisation>;
  readonly readPolicy: string;
  readonly createPolicy: string;
  readonly updatePolicy: string;
  readonly approveRejectPolicy: string;
  readonly deletePolicy: string;
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
        deletePolicy: "update",
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
      // Team removal is available to anyone who can open the organisation, including project partners.
      deletePolicy: "read",
      addDtos: async (document, query) => {
        const org = (await loadEntity()) as Organisation;
        const joinRequests = await this.queryOrg(org, query);
        await this.addOrgUserDtos(document, org, joinRequests, query);
      },
      handleCreate: async (document, _body, userId) => {
        const org = (await loadEntity()) as Organisation;
        await this.requestOrgJoin(org, userId);
        const user = await User.findOne({
          where: { id: userId },
          attributes: ["id", "uuid", "emailAddress", "firstName", "lastName", "phoneNumber", "jobRole", "roles"]
        });
        if (user == null) throw new UnauthorizedException("Authenticated user not found");
        document.addData(
          user.uuid as string,
          new UserAssociationDto(user, {
            status: PENDING,
            isManager: false,
            organisationName: (org as Organisation).name ?? "",
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
            associatedType: "organisations"
          })
        );
      }
    };
  }

  query(project: Project, query: UserAssociationQueryDto) {
    const findOptions: FindOptions<ProjectUser> = {
      where: { projectId: project.id },
      attributes: ["id", "userId", "isManaging"]
    };
    if (query.isManager != null) {
      (findOptions.where as WhereAttributeHash<ProjectUser>).isManaging = query.isManager;
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
      attributes: [
        "id",
        "uuid",
        "emailAddress",
        "firstName",
        "lastName",
        "organisationId",
        "phoneNumber",
        "jobRole",
        "roles"
      ]
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
          status: null,
          isManager: projectUser?.isManaging as boolean,
          organisationName: organisation?.name as string,
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
    if (!attributes.isManager) {
      const inviteCount = await ProjectInvite.count({
        where: { projectId: project.id, emailAddress: attributes.emailAddress }
      });
      if (inviteCount > 0) throw new BadRequestException("User has already been invited to this project");
    }

    const user = await User.findOne({
      where: { emailAddress: attributes.emailAddress },
      attributes: ["id", "emailAddress", "organisationId", "roles"]
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
    const projectUserCount = await ProjectUser.count({ where: { projectId } });
    const removedProjectUserCount = await ProjectUser.count({ where: { projectId, userId: { [Op.in]: userIds } } });
    if (removedProjectUserCount > 0 && projectUserCount - removedProjectUserCount === 0) {
      throw new BadRequestException("Cannot remove the last user from a project");
    }
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
      locale: "en-US",
      roles: ["project-developer"]
    } as User);
    const token = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({ userId: newUser.id, token });
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: attributes.emailAddress,
      firstName: attributes.firstName ?? null,
      lastName: attributes.lastName ?? null,
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

  queryOrg(organisation: Organisation, { status }: UserAssociationQueryDto) {
    // Approved members are the users that belong to the organisation; join requests are never approved.
    if (status === APPROVED) return Promise.resolve([]);

    const where: WhereOptions<OrganisationJoinRequest> = { organisationId: organisation.id };
    if (status != null) where.status = status;
    return OrganisationJoinRequest.findAll({ where, attributes: ["id", "userId", "status"] });
  }

  async addOrgUserDtos(
    document: DocumentBuilder,
    organisation: Organisation,
    joinRequests: OrganisationJoinRequest[],
    query: UserAssociationQueryDto
  ) {
    const includeMembers = query.status == null || query.status === APPROVED;

    let userIds = joinRequests.map(({ userId }) => userId);
    if (includeMembers) {
      const members = await User.findAll({
        where: { organisationId: organisation.id },
        attributes: ["id"]
      });
      userIds = uniq([...userIds, ...members.map(({ id }) => id)]);
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
        "lastLoggedInAt",
        "roles"
      ]
    });
    const filteredUsers = includeMembers ? users : users.filter(user => user.organisationId !== organisation.id);
    // Unregistered invitees already carry the organisation as their home organisation. Until they accept the
    // invite (which happens at signup), the FE shows them as "Awaiting Response" instead of "Accepted".
    const pendingInviteEmails = new Set(
      (
        await OrganisationInvite.findAll({
          where: { organisationId: organisation.id, acceptedAt: null },
          attributes: ["emailAddress"]
        })
      ).map(invite => invite.emailAddress)
    );
    filteredUsers.forEach(user => {
      const isMember = user.organisationId === organisation.id;
      const status = isMember ? APPROVED : (joinRequests.find(({ userId }) => userId === user.id)?.status ?? null);
      const dto = new UserAssociationDto(user, {
        status,
        isManager: false,
        organisationName: organisation.name ?? "",
        associatedType: "organisations",
        invitePending: isMember && pendingInviteEmails.has(user.emailAddress)
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
      attributes: ["id", "uuid", "emailAddress", "organisationId"]
    });
    if (users.length === 0) throw new NotFoundException("Users not found");
    const memberIds = users.filter(user => user.organisationId === organisationId).map(({ id }) => id);
    if (memberIds.length > 0) {
      const remainingMembers = await User.count({ where: { organisationId, id: { [Op.notIn]: memberIds } } });
      if (remainingMembers === 0) {
        throw new BadRequestException("Cannot remove the last user from an organisation");
      }
      await User.update({ organisationId: null }, { where: { id: { [Op.in]: memberIds } } });
    }

    await OrganisationJoinRequest.destroy({
      where: { organisationId, userId: { [Op.in]: users.map(({ id }) => id) } }
    });
    await OrganisationInvite.destroy({
      where: { organisationId, emailAddress: { [Op.in]: users.map(user => user.emailAddress) } }
    });
    return users.map(user => user.uuid);
  }

  async inviteOrganisationUser(
    organisation: Organisation,
    { emailAddress, firstName, lastName, callbackUrl }: OrganisationInviteRequestDto
  ): Promise<OrganisationInvite> {
    const inviteCount = await OrganisationInvite.count({ where: { organisationId: organisation.id, emailAddress } });
    if (inviteCount > 0) {
      throw new UnprocessableEntityException(
        "This user has already been invited to this organisation, please try a different email address."
      );
    }

    const existingUser = await User.findOne({
      where: { emailAddress },
      attributes: ["id", "uuid", "emailAddress", "organisationId", "roles"]
    });
    if (existingUser != null) {
      return this.addRegisteredUserToOrganisation(organisation, existingUser, { firstName, lastName });
    }

    const newUser = await User.create({
      organisationId: organisation.id,
      emailAddress,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      password: crypto.randomBytes(32).toString("hex"),
      locale: "en-US",
      roles: ["project-developer"]
    } as User);

    const token = crypto.randomBytes(32).toString("hex");
    const invite = await OrganisationInvite.create({
      organisationId: organisation.id,
      emailAddress,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      token
    });
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

  /**
   * Registered users are added to the organisation straight away as approved members, so there is no
   * invitation to accept. The invite row is still written (already accepted) so the response shape is the same.
   */
  private async addRegisteredUserToOrganisation(
    organisation: Organisation,
    user: User,
    { firstName, lastName }: { firstName?: string; lastName?: string }
  ): Promise<OrganisationInvite> {
    if (!user.roles.includes("project-developer")) {
      throw new UnprocessableEntityException(
        "This user type cannot be added to the organisation, please try a different email address."
      );
    }

    if (user.organisationId === organisation.id) {
      throw new UnprocessableEntityException("This user is already a member of the organisation.");
    }

    const pendingElsewhere = await OrganisationJoinRequest.count({
      where: { userId: user.id, status: PENDING, organisationId: { [Op.ne]: organisation.id } }
    });
    if (pendingElsewhere > 0) {
      throw new UnprocessableEntityException(
        "This user has a pending request to join another organisation. If this is incorrect, please reach out to TerraMatch support at support@terramatch.org."
      );
    }

    user.organisationId = organisation.id;
    await user.save();
    await OrganisationJoinRequest.destroy({ where: { organisationId: organisation.id, userId: user.id } });

    const invite = await OrganisationInvite.create({
      organisationId: organisation.id,
      emailAddress: user.emailAddress,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      token: crypto.randomBytes(32).toString("hex"),
      acceptedAt: new Date()
    } as OrganisationInvite);

    try {
      await new OrganisationUserApprovedEmail({
        organisationId: organisation.id,
        userId: user.id
      }).sendLater(this.emailQueue);
    } catch (error) {
      this.logger.error(`Failed to queue organisation user approved email for organisation ${organisation.id}`, error);
    }

    return invite;
  }

  async requestOrgJoin(organisation: Organisation, userId: number): Promise<User> {
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "uuid", "emailAddress", "organisationId"]
    });
    if (user == null) throw new UnauthorizedException("Authenticated user not found");
    if (user.organisationId === organisation.id) {
      throw new BadRequestException("User is already a member of this organisation");
    }

    const [joinRequest, created] = await OrganisationJoinRequest.findOrCreate({
      where: { organisationId: organisation.id, userId },
      defaults: { organisationId: organisation.id, userId, status: PENDING }
    });
    if (!created && joinRequest.status !== PENDING) {
      joinRequest.status = PENDING;
      await joinRequest.save();
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
      attributes: [
        "id",
        "uuid",
        "emailAddress",
        "firstName",
        "lastName",
        "organisationId",
        "phoneNumber",
        "jobRole",
        "roles"
      ]
    });

    if (user == null) {
      throw new NotFoundException(`User with UUID ${userUuid} not found`);
    }

    const isMember = user.organisationId === organisation.id;
    const joinRequest = await OrganisationJoinRequest.findOne({
      where: { organisationId: organisation.id, userId: user.id }
    });
    const currentStatus = isMember ? APPROVED : joinRequest?.status;
    if (currentStatus == null) {
      throw new BadRequestException("User does not have a relationship with this organisation");
    }

    // Removing a member is a rejection: they stay visible in the rejected list until deleted.
    const allowedFrom: OrganisationMembershipStatus[] = status === APPROVED ? [PENDING, REJECTED] : [PENDING, APPROVED];
    if (!allowedFrom.includes(currentStatus)) {
      throw new BadRequestException(`Cannot ${status} a user with status '${currentStatus}'`);
    }

    if (status === APPROVED) {
      user.organisationId = organisation.id;
      await user.save();
      // Membership replaces this request, along with any others the user still has waiting on a decision.
      await OrganisationJoinRequest.destroy({
        where: { userId: user.id, [Op.or]: [{ organisationId: organisation.id }, { status: PENDING }] }
      });
    } else {
      if (isMember) {
        const otherMembers = await User.count({ where: { organisationId: organisation.id, id: { [Op.ne]: user.id } } });
        if (otherMembers === 0) {
          throw new BadRequestException("Cannot remove the last user from the organisation");
        }
        user.organisationId = null;
        await user.save();
      }

      if (joinRequest == null) {
        await OrganisationJoinRequest.create({ organisationId: organisation.id, userId: user.id, status: REJECTED });
      } else {
        joinRequest.status = REJECTED;
        await joinRequest.save();
      }
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
      if (!user.roles.includes("project-manager")) throw new BadRequestException("User is not a project manager");
      const projectUser = await ProjectUser.findOne({
        where: { projectId: project.id, userId: user.id, isManaging: true }
      });
      if (projectUser != null) throw new BadRequestException("User is already a project manager");
      await ProjectUser.create({ projectId: project.id, userId: user.id, isManaging: true });
      return;
    }

    // Admins must not gain project developer access through an invite, even if they also hold that role.
    if (!user.permissions.includes("manage-own") || user.roles.some(role => role.startsWith("admin-"))) {
      throw new BadRequestException("Only project developers can be invited to a project");
    }
    const projectUserCount = await ProjectUser.count({ where: { projectId: project.id, userId: user.id } });
    if (projectUserCount > 0) throw new BadRequestException("User is already associated with this project");

    await ProjectUser.create({ projectId: project.id, userId: user.id });

    const token = crypto.randomBytes(32).toString("hex");
    await ProjectInvite.create({
      projectId: project.id,
      emailAddress: user.emailAddress,
      firstName: attributes.firstName ?? null,
      lastName: attributes.lastName ?? null,
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
      attributes: [
        "id",
        "uuid",
        "emailAddress",
        "firstName",
        "lastName",
        "organisationId",
        "phoneNumber",
        "jobRole",
        "roles"
      ]
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

    await ProjectUser.findOrCreate({
      where: { projectId: project.id, userId: user.id },
      defaults: { projectId: project.id, userId: user.id }
    });

    invite.acceptedAt = new Date();
    await invite.save();

    return { user, project, invite };
  }
}
