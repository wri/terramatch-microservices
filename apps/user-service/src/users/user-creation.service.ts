import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ModelHasRole, Role, User, Verification } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import crypto from "node:crypto";
import { TemplateService } from "@terramatch-microservices/common/email/template.service";
import { omit } from "lodash";
import bcrypt from "bcryptjs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Injectable()
export class UserCreationService {
  protected readonly logger = new TMLogger(UserCreationService.name);
  private roles = ["project-developer", "funder", "government"];

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly localizationService: LocalizationService
  ) {}

  async createNewUser(request: UserNewRequest): Promise<User> {
    const bodyKey = "user-verification.body";
    const subjectKey = "user-verification.subject";
    const titleKey = "user-verification.title";
    const ctaKey = "user-verification.cta";

    const localizationKeys = await this.localizationService.getLocalizationKeys([
      bodyKey,
      subjectKey,
      titleKey,
      ctaKey
    ]);

    if (!localizationKeys.length) {
      throw new NotFoundException("Localizations not found");
    }

    const bodyLocalization = localizationKeys.find(x => x.key == bodyKey);
    const subjectLocalization = localizationKeys.find(x => x.key == subjectKey);
    const titleLocalization = localizationKeys.find(x => x.key == titleKey);
    const ctaLocalization = localizationKeys.find(x => x.key == ctaKey);

    if (bodyLocalization == null) {
      throw new NotFoundException("Localization body not found");
    }

    if (subjectLocalization == null) {
      throw new NotFoundException("Localization subject not found");
    }

    if (titleLocalization == null) {
      throw new NotFoundException("Localization title not found");
    }

    if (ctaLocalization == null) {
      throw new NotFoundException("Localization CTA not found");
    }

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
      throw new UnprocessableEntityException("User already exist");
    }

    try {
      const hashPassword = await bcrypt.hash(request.password, 10);
      const callbackUrl = request.callbackUrl;
      const newUser = omit(request, ["callbackUrl", "role", "password"]);

      const user = await User.create({ ...newUser, uuid: crypto.randomUUID(), password: hashPassword });

      await user.reload();

      await ModelHasRole.findOrCreate({
        where: { modelId: user.id, roleId: roleEntity.id },
        defaults: { modelId: user.id, roleId: roleEntity.id, modelType: User.LARAVEL_TYPE }
      });

      const token = crypto.randomBytes(32).toString("hex");
      await this.saveUserVerification(user.id, token);
      await this.sendEmailVerification(
        user,
        token,
        subjectLocalization.value,
        bodyLocalization.value,
        titleLocalization.value,
        ctaLocalization.value,
        callbackUrl
      );
      return user;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  private async formatEmail(
    locale: string,
    token: string,
    body: string,
    title: string,
    cta: string,
    callbackUrl: string
  ) {
    const emailData = {
      title: await this.localizationService.translate(title, locale),
      body: await this.localizationService.translate(body, locale),
      link: `${callbackUrl}/${token}`,
      cta: await this.localizationService.translate(cta, locale),
      monitoring: "monitoring"
    };
    return this.templateService.render("user-service/views/default-email.hbs", emailData);
  }

  private async sendEmailVerification(
    user: User,
    token: string,
    subject: string,
    bodyLocalization: string,
    titleLocalization: string,
    ctaLocalization: string,
    callbackUrl: string
  ) {
    const body = await this.formatEmail(
      user.locale,
      token,
      bodyLocalization,
      titleLocalization,
      ctaLocalization,
      callbackUrl
    );
    await this.emailService.sendEmail(user.emailAddress, subject, body);
  }

  private async saveUserVerification(userId: number, token: string) {
    await Verification.findOrCreate({
      where: { userId },
      defaults: { token }
    });
  }
}
