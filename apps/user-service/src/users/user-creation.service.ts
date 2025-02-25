import { Injectable, NotFoundException, LoggerService } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User, Verification } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import crypto from "node:crypto";
import { TemplateService } from "@terramatch-microservices/common/email/template.service";
import { omit } from "lodash";

@Injectable()
export class UserCreationService {
  protected readonly logger: LoggerService = new TMLogService(UserCreationService.name);

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

    try {
      const callbackUrl = request.callbackUrl;
      const role = request.role; // TODO: Implement assign role
      const requestUser = omit(request, ["callbackUrl", "role"]);
      const [user] = await User.findOrCreate({
        where: { emailAddress: request.emailAddress },
        defaults: { ...requestUser, uuid: crypto.randomUUID() }
      });

      await user.reload();

      const token = await this.jwtService.signAsync({ userId: user.uuid });
      const body = await this.formatEmail(
        user.locale,
        token,
        bodyLocalization.value,
        titleLocalization.value,
        ctaLocalization.value,
        callbackUrl
      );
      await this.saveUserVerification(user.id, token);
      await this.sendEmailVerification(user, subjectLocalization.value, body);
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
    const resetLink = `${callbackUrl}?token=${token}`;
    const bodyEmail = await this.localizationService.translate(body, locale);
    const titleEmail = await this.localizationService.translate(title, locale);
    const ctaEmail = await this.localizationService.translate(cta, locale);
    const emailData = {
      backend_url: null,
      banner: null,
      title: titleEmail,
      body: bodyEmail,
      link: resetLink,
      cta: ctaEmail,
      year: new Date().getFullYear()
    };
    return this.templateService.render(emailData);
  }

  private async sendEmailVerification(user: User, subject: string, body: string) {
    await this.emailService.sendEmail(user.emailAddress, subject, body);
  }

  private async saveUserVerification(userId: number, token: string) {
    await Verification.findOrCreate({
      where: { userId },
      defaults: { token }
    });
  }
}
