import { User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class UserPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("users-manage")) {
      this.builder.can(["read", "readAll", "create", "update", "verify", "delete"], User);
    }

    if (await this.isVerifiedAdmin()) {
      this.builder.can(["readAll", "update", "verify", "delete"], User);
    }

    this.builder.can(["read", "update", "verify"], User, { id: this.userId });
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
