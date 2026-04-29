import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { PasswordReset, User } from "@terramatch-microservices/database/entities";
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
    let passwordReset;
    try {
      const payload = await this.jwtService.verifyAsync(resetToken);
      userGuid = payload.sub;
    } catch (error) {
      this.logger.error(error);
      passwordReset = await PasswordReset.findOne({ where: { token: resetToken } });
      const userWithUuid = await User.findOne({ where: { id: passwordReset?.userId }, attributes: ["uuid"] });
      if (passwordReset != null) {
        userGuid = userWithUuid?.uuid;
      } else {
        throw new BadRequestException("Provided token is invalid or expired");
      }
    }

    const user = await User.findOne({
      where: { uuid: userGuid },
      attributes: ["id", "uuid", "emailAddress", "emailAddressVerifiedAt"]
    });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateBody: Partial<User> = { password: hashedPassword };
    if (user.emailAddressVerifiedAt == null) {
      updateBody.emailAddressVerifiedAt = new Date();
    }

    await User.update(updateBody, { where: { id: user.id } });

    if (passwordReset != null) {
      await PasswordReset.destroy({ where: { id: passwordReset.id } });
    }

    return { email: user.emailAddress, uuid: user.uuid };
  }

  async getResetPassword(token: string) {
    const passwordReset = await PasswordReset.findOne({ where: { token } });
    if (passwordReset == null) {
      return { emailAddress: null, uuid: null, tokenUsed: true };
    }

    const sevenDaysAgo = new Date(passwordReset.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (sevenDaysAgo < new Date()) {
      await PasswordReset.destroy({ where: { id: passwordReset.id } });
      return { emailAddress: null, uuid: null, tokenUsed: true };
    }

    const user = await User.findOne({
      where: { id: passwordReset.userId },
      attributes: ["emailAddress", "uuid", "locale"]
    });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    return { emailAddress: user.emailAddress, uuid: user.uuid, locale: user.locale, tokenUsed: false };
  }
}
