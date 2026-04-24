import { Injectable, NotFoundException } from "@nestjs/common";
import { User, Verification } from "@terramatch-microservices/database/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import crypto from "node:crypto";

const EMAIL_KEYS = {
  body: "user-verification.body",
  subjectKey: "user-verification.subject",
  titleKey: "user-verification.title",
  ctaKey: "user-verification.cta"
} as const;

@Injectable()
export class VerificationUserService {
  protected readonly logger = new TMLogger(VerificationUserService.name);

  constructor(private readonly emailService: EmailService) {}

  async verify(token: string) {
    const verification = await Verification.findOne({
      where: { token },
      include: [{ association: "user", attributes: ["id", "uuid", "emailAddressVerifiedAt"] }]
    });

    if (verification?.user == null) throw new NotFoundException("Verification token invalid");
    const user = verification.user;
    try {
      user.emailAddressVerifiedAt = new Date();
      await user.save();
      await verification.destroy();
      return { uuid: user.uuid, isVerified: true };
    } catch (error) {
      this.logger.error(error);
      return { uuid: user.uuid, isVerified: false };
    }
  }

  async resendVerificationEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({
      where: { emailAddress },
      attributes: ["id", "emailAddress", "locale"]
    });

    if (user == null || user.emailAddress == null) {
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");

    await Verification.create({
      userId: user.id,
      token
    } as Verification);

    const link =
      callbackUrl != null && callbackUrl.length > 0
        ? `${callbackUrl}${encodeURIComponent(token)}`
        : `/verify?token=${encodeURIComponent(token)}`;

    await this.emailService.sendI18nTemplateEmail(user.emailAddress, user.locale, EMAIL_KEYS, {
      additionalValues: { link }
    });
  }
}
