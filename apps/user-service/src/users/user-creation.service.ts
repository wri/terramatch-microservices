import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ModelHasRole, Role, User, Verification } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { UserCreateAttributes } from "./dto/user-create.dto";
import crypto from "node:crypto";
import { omit } from "lodash";
import bcrypt from "bcryptjs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

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

  async createNewUser(request: UserCreateAttributes): Promise<User> {
    const role = request.role;
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
      const hashPassword = await bcrypt.hash(request.password, 10);
      const callbackUrl = request.callbackUrl;
      const newUser = omit(request, ["callbackUrl", "role", "password"]);

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
