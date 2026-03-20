import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  ModelHasRole,
  Role,
  User,
  Verification,
  PasswordReset,
  Organisation,
  OrganisationInvite,
  ProjectInvite,
  ProjectUser
} from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { UserCreateAttributes, UserCreateBaseAttributes } from "./dto/user-create.dto";
import crypto from "node:crypto";
import { omit } from "lodash";
import bcrypt from "bcryptjs";
import { validate } from "class-validator";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { AdminUserCreateAttributes } from "./dto/admin-user-create.dto";
import { plainToInstance } from "class-transformer";

const EMAIL_KEYS = {
  body: "user-verification.body",
  subjectKey: "user-verification.subject",
  titleKey: "user-verification.title",
  ctaKey: "user-verification.cta"
} as const;

@Injectable()
export class UserCreationService {
  protected readonly logger = new TMLogger(UserCreationService.name);
  private roles = ["project-developer", "funder", "government"];

  constructor(private readonly emailService: EmailService) {}

  async createNewUser(isAuthenticated: boolean, request: UserCreateBaseAttributes): Promise<User> {
    if (isAuthenticated) {
      return await this.adminUserCreateProcess(request as AdminUserCreateAttributes);
    }
    return await this.unauthenticatedUserCreateProcess(request as UserCreateAttributes);
  }

  private async unauthenticatedUserCreateProcess(request: UserCreateAttributes): Promise<User> {
    if (request.token != null) {
      return this.completeInviteSignup(request);
    }
    return await this.signUpProcess(request);
  }

  private async signUpProcess(request: UserCreateAttributes): Promise<User> {
    const dto = plainToInstance(UserCreateAttributes, request);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
    const userCreateRequest = request as UserCreateAttributes;
    const role = userCreateRequest.role;
    if (!this.roles.includes(role)) {
      throw new UnprocessableEntityException("Role not valid");
    }

    const roleEntity = await Role.findOne({ where: { name: role } });
    if (roleEntity == null) {
      throw new NotFoundException("Role not found");
    }

    const userExists = (await User.count({ where: { emailAddress: request.emailAddress } })) !== 0;
    if (userExists) {
      throw new UnprocessableEntityException("User already exists");
    }

    try {
      const hashPassword = await bcrypt.hash(userCreateRequest.password, 10);
      const callbackUrl = userCreateRequest.callbackUrl;
      const newUser = omit(userCreateRequest, ["callbackUrl", "role", "password"]);

      const user = await User.create({ ...newUser, password: hashPassword } as User);

      await user.reload();

      await ModelHasRole.findOrCreate({
        where: { modelId: user.id, roleId: roleEntity.id },
        defaults: { modelId: user.id, roleId: roleEntity.id, modelType: User.LARAVEL_TYPE } as ModelHasRole
      });

      const token = crypto.randomBytes(32).toString("hex");
      await this.saveUserVerification(user.id, token);
      await this.sendEmailVerification(user, token, callbackUrl);
      return user;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("User creation failed");
    }
  }

  private async adminUserCreateProcess(request: AdminUserCreateAttributes): Promise<User> {
    const dto = plainToInstance(AdminUserCreateAttributes, request);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
    const adminUserCreateRequest = request as AdminUserCreateAttributes;
    const organisation = await Organisation.findOne({
      where: { uuid: adminUserCreateRequest.organisationUuid },
      attributes: ["id"]
    });
    if (organisation == null) {
      throw new NotFoundException("Organisation not found");
    }
    const userExists = (await User.count({ where: { emailAddress: request.emailAddress } })) !== 0;
    if (userExists) {
      throw new UnprocessableEntityException("User already exists");
    }
    try {
      const newUser = omit(adminUserCreateRequest, ["role", "organisationUuid"]);
      const user = await User.create({ ...newUser, organisationId: organisation.id } as User);
      const role = adminUserCreateRequest.role;
      const roleEntity = await Role.findOne({ where: { name: role } });
      if (roleEntity == null) {
        throw new NotFoundException("Role not found");
      }

      await ModelHasRole.findOrCreate({
        where: { modelId: user.id, roleId: roleEntity.id },
        defaults: { modelId: user.id, roleId: roleEntity.id, modelType: User.LARAVEL_TYPE } as ModelHasRole
      });

      return user;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("User creation failed");
    }
  }

  private async completeInviteSignup(request: UserCreateAttributes): Promise<User> {
    const token = request.token;
    const passwordReset = await PasswordReset.findOne({
      where: { token },
      include: [{ association: "user" }]
    });

    if (passwordReset == null || passwordReset.user == null) {
      throw new NotFoundException("Invalid signup token");
    }

    const user = passwordReset.user;

    const organisationInvites = await OrganisationInvite.findAll({
      where: { emailAddress: user.emailAddress, acceptedAt: null }
    });

    if (organisationInvites.length > 0) {
      for (const invite of organisationInvites) {
        invite.emailAddress = request.emailAddress;
        if (invite.acceptedAt == null) {
          invite.acceptedAt = new Date();
        }
        await invite.save();
      }
    } else {
      const projectInvites = await ProjectInvite.findAll({
        where: { emailAddress: user.emailAddress },
        include: [{ association: "project" }]
      });

      const projectIdsToAssociate: number[] = [];

      for (const invite of projectInvites) {
        invite.emailAddress = request.emailAddress;
        if (invite.acceptedAt == null) {
          invite.acceptedAt = new Date();
        }
        await invite.save();

        if (invite.project != null) {
          projectIdsToAssociate.push(invite.project.id);
        }
      }

      for (const projectId of projectIdsToAssociate) {
        const [projectUser, created] = await ProjectUser.findOrCreate({
          where: { projectId, userId: user.id },
          defaults: {
            projectId,
            userId: user.id,
            isMonitoring: true,
            status: "active"
          }
        });

        if (!created) {
          projectUser.isMonitoring = true;
          projectUser.status = "active";
          await projectUser.save();
        }
      }
    }

    const hashPassword = await bcrypt.hash(request.password, 10);
    user.firstName = request.firstName;
    user.lastName = request.lastName;
    user.jobRole = request.jobRole;
    user.phoneNumber = request.phoneNumber;
    user.emailAddress = request.emailAddress;
    user.password = hashPassword;
    user.emailAddressVerifiedAt = new Date();

    const role = "project-developer";
    const roleEntity = await Role.findOne({ where: { name: role } });
    if (roleEntity == null) {
      throw new NotFoundException("Role not found");
    }

    await ModelHasRole.findOrCreate({
      where: { modelId: user.id, roleId: roleEntity.id },
      defaults: { modelId: user.id, roleId: roleEntity.id, modelType: User.LARAVEL_TYPE } as ModelHasRole
    });

    await user.save();

    await passwordReset.destroy();

    return user;
  }

  private async sendEmailVerification({ emailAddress, locale }: User, token: string, callbackUrl: string) {
    await this.emailService.sendI18nTemplateEmail(emailAddress, locale, EMAIL_KEYS, {
      additionalValues: { link: `${callbackUrl}/${token}`, monitoring: "monitoring" }
    });
  }

  private async saveUserVerification(userId: number, token: string) {
    await Verification.findOrCreate({
      where: { userId },
      defaults: { token } as Verification
    });
  }
}
