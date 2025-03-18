import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Verification } from "@terramatch-microservices/database/entities/verification.entity";

@Injectable()
export class VerificationUserService {
  protected readonly logger = new Logger(VerificationUserService.name);

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
}
