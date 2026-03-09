import { Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { User } from "@terramatch-microservices/database/entities";

const PASSWORD_BCRYPT_ROUNDS = 10;

/**
 * Admin-only user actions: reset password and verify email by user UUID.
 * V2 contract: same semantics and response bodies as wri-terramatch-api admin endpoints.
 */
@Injectable()
export class AdminUsersService {
  /**
   * Reset a user's password by UUID. Caller must be authorized (policy resetPassword on User).
   */
  async resetPasswordByUuid(uuid: string, password: string): Promise<void> {
    const user = await User.findOne({
      where: { uuid },
      attributes: ["id", "uuid"]
    });
    if (user == null) {
      throw new NotFoundException("No user found.");
    }

    const hashedPassword = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS);
    await user.update({ password: hashedPassword });
  }

  /**
   * Mark a user's email as verified by UUID. Caller must be authorized (policy verify on User).
   */
  async verifyByUuid(uuid: string): Promise<void> {
    const user = await User.findOne({
      where: { uuid },
      attributes: ["id", "uuid", "emailAddressVerifiedAt"]
    });
    if (user == null) {
      throw new NotFoundException("No user found.");
    }

    await user.update({ emailAddressVerifiedAt: new Date() });
  }
}
