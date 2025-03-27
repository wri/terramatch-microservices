import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { TemplateService } from "@terramatch-microservices/common/email/template.service";

@Injectable()
export class ResetPasswordService {
  protected readonly logger = new TMLogger(ResetPasswordService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly localizationService: LocalizationService,
    private readonly templateService: TemplateService
  ) {}

  async sendResetPasswordEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({ where: { emailAddress }, attributes: ["id", "uuid", "locale", "emailAddress"] });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const bodyKey = "reset-password.body";
    const subjectKey = "reset-password.subject";
    const titleKey = "reset-password.title";
    const ctaKey = "reset-password.cta";

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

    const resetToken = await this.jwtService.signAsync({ sub: user.uuid }, { expiresIn: "2h" });

    const resetLink = `${callbackUrl}/${resetToken}`;
    const bodyEmail = await this.formatEmail(
      user.locale,
      bodyLocalization.value,
      titleLocalization.value,
      ctaLocalization.value,
      resetLink
    );
    await this.emailService.sendEmail(user.emailAddress, subjectLocalization.value, bodyEmail);

    return { email: user.emailAddress, uuid: user.uuid };
  }

  private async formatEmail(locale: string, body: string, title: string, cta: string, callbackUrl: string) {
    const emailData = {
      title: await this.localizationService.translate(title, locale),
      body: await this.localizationService.translate(body, locale),
      link: callbackUrl,
      cta: await this.localizationService.translate(cta, locale),
      monitoring: "monitoring"
    };
    return this.templateService.render("user-service/views/default-email.hbs", emailData);
  }

  async resetPassword(resetToken: string, newPassword: string) {
    let userGuid;
    try {
      const payload = await this.jwtService.verifyAsync(resetToken);
      userGuid = payload.sub;
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException("Provided token is invalid or expired");
    }

    const user = await User.findOne({ where: { uuid: userGuid }, attributes: ["id", "uuid", "emailAddress"] });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: user.id } });

    return { email: user.emailAddress, uuid: user.uuid };
  }
}
