import { User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class UserPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("users-manage")) {
      this.builder.can(["read", "create", "update", "verify"], User);
    } else {
      this.builder.can("read", User, { id: this.userId });
      this.builder.can("update", User, { id: this.userId });
    }

    if (await this.isVerifiedAdmin()) {
      this.builder.can("verify", User);
    }

    this.builder.can("verify", User, { id: this.userId });
  }

  protected _isVerifiedAdmin?: boolean;
  protected async isVerifiedAdmin(): Promise<boolean> {
    if (this._isVerifiedAdmin != null) return this._isVerifiedAdmin;

    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["emailAddressVerifiedAt"],
      include: [{ association: "roles", attributes: ["name"] }]
    });

    if (user == null) return (this._isVerifiedAdmin = false);

    const hasAdminRole = user.roles?.some(({ name }) => name.startsWith("admin-")) ?? false;
    const isEmailVerified = user.emailAddressVerifiedAt != null;

    return (this._isVerifiedAdmin = hasAdminRole && isEmailVerified);
  }
}
