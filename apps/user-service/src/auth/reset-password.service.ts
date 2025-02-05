import { Injectable, NotFoundException, BadRequestException, LoggerService } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";

@Injectable()
export class ResetPasswordService {
  protected readonly logger: LoggerService = new TMLogService(ResetPasswordService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly localizationService: LocalizationService
  ) {}

  async sendResetPasswordEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({ where: { emailAddress }, attributes: ["id", "uuid", "locale", "emailAddress"] });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const bodyKey = "reset-password.body";
    const subjectKey = "reset-password.subject";

    const localizationKeys = await this.localizationService.getLocalizationKeys([bodyKey, subjectKey]);

    if (!localizationKeys.length) {
      throw new NotFoundException("Localizations not found");
    }

    const bodyLocalization = localizationKeys.find(x => x.key == bodyKey);
    const subjectLocalization = localizationKeys.find(x => x.key == subjectKey);

    if (bodyLocalization == null) {
      throw new NotFoundException("Localization body not found");
    }

    if (subjectLocalization == null) {
      throw new NotFoundException("Localization subject not found");
    }

    const resetToken = await this.jwtService.signAsync({ sub: user.uuid }, { expiresIn: "2h" });

    const bodyEmailContent = await this.localizationService.translate(bodyLocalization.value, user.locale);
    const resetLink = `${callbackUrl}/${resetToken}`;
    const bodyEmail = this.formatBody(bodyEmailContent, resetLink);
    console.log(user.emailAddress);
    await this.emailService.sendEmail(user.emailAddress, subjectLocalization.value, bodyEmail);

    return { email: user.emailAddress, uuid: user.uuid };
  }

  private formatBody(bodyEmailContent: string, resetLink: string) {
    const anchor = `<a href="${resetLink}" target="_blank">link</a>`;
    return bodyEmailContent.replace("link", anchor).replace("enlace", anchor).replace("lien", anchor);
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
