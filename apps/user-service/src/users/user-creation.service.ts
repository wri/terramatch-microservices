import { Injectable, NotFoundException, LoggerService } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import crypto from "node:crypto";

@Injectable()
export class UserCreationService {
  protected readonly logger: LoggerService = new TMLogService(UserCreationService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly localizationService: LocalizationService
  ) {}

  //public const DEFAULT_USER_ROLE = 'project-developer';
  // public const USER_SELECTABLE_ROLES = [self::DEFAULT_USER_ROLE, 'funder', 'government'];

  async createNewUser(request: UserNewRequest): Promise<User> {
    // receive a callback_url from the request
    // perform the validation for payload of the user
    // save the user, assign the rol passing on the payload, if the rol is invalid, will assign a default rol 'project-developer'
    // send the email verification using te callback_url and user

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

    const user = await User.create(request);
    user.uuid = crypto.randomUUID();
    await user.save();
    await user.reload();

    const body = await this.formatBody(
      user,
      bodyLocalization.value,
      titleLocalization.value,
      ctaLocalization.value,
      request.callbackUrl
    );
    console.log(body);
    await this.sendEmailVerification(user, subjectLocalization.value, body);
    return user;
  }

  private async formatBody(user: User, body: string, title: string, cta: string, callbackUrl: string) {
    const token = this.jwtService.sign({ userId: user.uuid });
    const resetLink = `${callbackUrl}?token=${token}`;
    const bodyEmail = await this.localizationService.translate(body, user.locale);
    const titleEmail = await this.localizationService.translate(title, user.locale);
    const ctaEmail = await this.localizationService.translate(cta, user.locale);
    const emailData = {
      backend_url: null,
      banner: null,
      title: titleEmail,
      body: bodyEmail,
      link: resetLink,
      cta: ctaEmail,
      year: new Date().getFullYear()
    };
    return this.emailService.renderTemplate(emailData);
  }

  private async sendEmailVerification(user: User, subject: string, body: string) {
    await this.emailService.sendEmail(user.emailAddress, subject, body);
  }
}
