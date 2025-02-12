import { Injectable, NotFoundException, LoggerService } from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Verification } from "@terramatch-microservices/database/entities/verification.entity";

@Injectable()
export class VerificationUserService {
  protected readonly logger: LoggerService = new TMLogService(VerificationUserService.name);

  async verify(userId: number, token: string) {
    // search on verifications table by token
    // get the user by token
    // update email_address_verified_at the on the user setting utc now
    // delete verification row
    const verification = await Verification.findOne({ where: { token } });

    if (verification == null) {
      throw new NotFoundException("Verification token not found");
    }

    const user = await User.findOne({ where: { id: userId }, attributes: ["id", "uuid", "emailAddressVerifiedAt"] });
    if (user == null) {
      throw new NotFoundException("User not found");
    }
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
