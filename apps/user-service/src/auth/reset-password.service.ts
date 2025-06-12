import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const EMAIL_KEYS = {
  body: "reset-password.body",
  subject: "reset-password.subject",
  title: "reset-password.title",
  cta: "reset-password.cta"
} as const;

@Injectable()
export class ResetPasswordService {
  protected readonly logger = new TMLogger(ResetPasswordService.name);

  constructor(private readonly jwtService: JwtService, private readonly emailService: EmailService) {}

  async sendResetPasswordEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({ where: { emailAddress }, attributes: ["id", "uuid", "locale"] });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const { uuid, locale } = user;
    const resetToken = await this.jwtService.signAsync({ sub: uuid }, { expiresIn: "7d" });

    const resetLink = `${callbackUrl}/${resetToken}`;
    await this.emailService.sendI18nTemplateEmail(emailAddress, locale, EMAIL_KEYS, {
      additionalValues: { link: resetLink, monitoring: "monitoring" }
    });

    return { email: emailAddress, uuid };
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
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: user.id } });

    return { email: user.emailAddress, uuid: user.uuid };
  }
}
