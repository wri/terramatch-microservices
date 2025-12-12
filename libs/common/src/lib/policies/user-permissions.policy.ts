import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { User } from "@terramatch-microservices/database/entities";

export type BuilderType = ReturnType<typeof createMongoAbility>;

export abstract class UserPermissionsPolicy {
  /**
   * Most policies can create their rule set based on the user id and the user permissions. For
   * those that need access to more resources (like the user's organisation_id), the addRules()
   * method below is async so that calls to the DB can be made.
   *
   * Note that the builder is passed in instead of created here. This is so that the PolicyService
   * can support
   */
  constructor(
    protected readonly userId: number,
    protected readonly permissions: string[],
    protected readonly builder: AbilityBuilder<BuilderType>
  ) {}

  private _frameworks?: FrameworkKey[];
  protected get frameworks() {
    if (this._frameworks != null) return this._frameworks;

    return (this._frameworks = this.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey));
  }

  protected _organisationUuids?: string[] | null;
  protected async getOrgUuids() {
    if (this._organisationUuids == null) this._organisationUuids = await User.orgUuids(this.userId);

    return this._organisationUuids;
  }

  abstract addRules(): Promise<void>;
}
