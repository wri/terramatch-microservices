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
    if (this._organisationUuids != null) return this._organisationUuids;

    this._organisationUuids = [];

    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "organisationId"],
      include: [{ association: "organisation", attributes: ["uuid"] }]
    });
    if (user == null) return this._organisationUuids;

    if (user.organisation != null) this._organisationUuids.push(user.organisation.uuid);

    const confirmed = await user.$get("organisationsConfirmed", { attributes: ["uuid"] });
    this._organisationUuids.push(...confirmed.map(({ uuid }) => uuid));

    return this._organisationUuids;
  }

  abstract addRules(): Promise<void>;
}
