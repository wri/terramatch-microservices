import { uniq } from "lodash";
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  BelongsToMany,
  Column,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, col, DATE, fn, Op, STRING, UUID } from "sequelize";
import { Role } from "./role.entity";
import { ModelHasRole } from "./model-has-role.entity";
import { Permission } from "./permission.entity";
import { Framework } from "./framework.entity";
import { Project } from "./project.entity";
import { ProjectUser } from "./project-user.entity";
import { Organisation } from "./organisation.entity";
import { OrganisationUser } from "./organisation-user.entity";
import { FrameworkUser } from "./framework-user.entity";

@Table({ tableName: "users", underscored: true, paranoid: true })
export class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  // There are many rows in the prod DB without a UUID assigned, so this cannot be a unique
  // index until that is fixed.
  @AllowNull
  @Index({ unique: false })
  @Column(UUID)
  uuid: string | null;

  @ForeignKey(() => Organisation)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @AllowNull
  @Column(STRING)
  firstName: string | null;

  @AllowNull
  @Column(STRING)
  lastName: string | null;

  @AllowNull
  @Unique
  @Column(STRING)
  emailAddress: string;

  @AllowNull
  @Column(STRING)
  password: string | null;

  @AllowNull
  @Column(DATE)
  emailAddressVerifiedAt: Date | null;

  @AllowNull
  @Column(DATE)
  lastLoggedInAt: Date | null;

  @AllowNull
  @Column(STRING)
  jobRole: string | null;

  @AllowNull
  @Column(STRING)
  facebook: string | null;

  @AllowNull
  @Column(STRING)
  twitter: string | null;

  @AllowNull
  @Column(STRING)
  linkedin: string | null;

  @AllowNull
  @Column(STRING)
  instagram: string | null;

  @AllowNull
  @Column(STRING)
  avatar: string | null;

  @AllowNull
  @Column(STRING)
  phoneNumber: string | null;

  @AllowNull
  @Column(STRING)
  whatsappPhone: string | null;

  @Default(true)
  @Column(BOOLEAN)
  isSubscribed: boolean;

  @Default(true)
  @Column(BOOLEAN)
  hasConsented: boolean;

  @AllowNull
  @Column(STRING)
  banners: string | null;

  @AllowNull
  @Column(STRING)
  apiKey: string | null;

  @AllowNull
  @Column(STRING)
  country: string | null;

  @AllowNull
  @Column(STRING)
  program: string | null;

  @Column(STRING)
  locale: string;

  @BelongsToMany(() => Role, {
    foreignKey: "modelId",
    through: {
      model: () => ModelHasRole,
      unique: false,
      scope: {
        modelType: "App\\Models\\V2\\User"
      }
    }
  })
  roles: Role[];

  async loadRoles() {
    if (this.roles == null) this.roles = await (this as User).$get("roles");
    return this.roles;
  }

  /**
   * Depends on `roles` being loaded, either through include: [Role] on the find call, or by
   * await user.loadRoles()
   */
  get primaryRole() {
    return this.roles?.[0]?.name;
  }

  get fullName() {
    return this.firstName == null || this.lastName == null ? null : `${this.firstName} ${this.lastName}`;
  }

  @BelongsToMany(() => Project, () => ProjectUser)
  projects: Project[];

  async loadProjects() {
    if (this.projects == null) {
      this.projects = await (this as User).$get("projects");
    }
    return this.projects;
  }

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  async loadOrganisation() {
    if (this.organisation == null && this.organisationId != null) {
      this.organisation = await (this as User).$get("organisation");
    }
    return this.organisation;
  }

  @BelongsToMany(() => Organisation, () => OrganisationUser)
  organisations: Array<Organisation & { OrganisationUser: OrganisationUser }>;

  async loadOrganisations() {
    if (this.organisations == null) {
      this.organisations = await (this as User).$get("organisations");
    }
    return this.organisations;
  }

  @BelongsToMany(() => Organisation, {
    through: {
      model: () => OrganisationUser,
      scope: { status: "approved" }
    }
  })
  organisationsConfirmed: Array<Organisation & { OrganisationUser: OrganisationUser }>;

  async loadOrganisationsConfirmed() {
    if (this.organisationsConfirmed == null) {
      this.organisationsConfirmed = await (this as User).$get("organisationsConfirmed");
    }
    return this.organisationsConfirmed;
  }

  @BelongsToMany(() => Organisation, {
    through: {
      model: () => OrganisationUser,
      scope: { status: "requested" }
    }
  })
  organisationsRequested: Array<Organisation & { OrganisationUser: OrganisationUser }>;

  async loadOrganisationsRequested() {
    if (this.organisationsRequested == null) {
      this.organisationsRequested = await (this as User).$get("organisationsRequested");
    }
    return this.organisationsRequested;
  }

  private _primaryOrganisation: (Organisation & { OrganisationUser?: OrganisationUser }) | false;
  async primaryOrganisation(): Promise<(Organisation & { OrganisationUser?: OrganisationUser }) | null> {
    if (this._primaryOrganisation == null) {
      await this.loadOrganisation();
      if (this.organisation != null) {
        const userOrg = (
          await (this as User).$get("organisations", {
            limit: 1,
            where: { id: this.organisation.id }
          })
        )[0];
        return (this._primaryOrganisation = userOrg ?? this.organisation);
      }

      const confirmed = (await (this as User).$get("organisationsConfirmed", { limit: 1 }))[0];
      if (confirmed != null) {
        return (this._primaryOrganisation = confirmed);
      }

      const requested = (await (this as User).$get("organisationsRequested", { limit: 1 }))[0];
      if (requested != null) {
        return (this._primaryOrganisation = requested);
      }

      this._primaryOrganisation = false;
    }

    return this._primaryOrganisation === false ? null : this._primaryOrganisation;
  }

  @BelongsToMany(() => Framework, () => FrameworkUser)
  frameworks: Framework[];

  async loadFrameworks() {
    if (this.frameworks == null) {
      this.frameworks = await (this as User).$get("frameworks");
    }
    return this.frameworks;
  }

  private _myFrameworks?: Framework[];
  async myFrameworks(): Promise<Framework[]> {
    if (this._myFrameworks == null) {
      await this.loadRoles();
      const isAdmin = this.roles.find(({ name }) => name.startsWith("admin-")) != null;

      await this.loadFrameworks();

      let frameworkSlugs: string[] = this.frameworks.map(({ slug }) => slug);
      if (isAdmin) {
        // Admins have access to all frameworks their permissions say they do
        const permissions = await Permission.getUserPermissionNames(this.id);
        const prefix = "framework-";
        frameworkSlugs = [
          ...frameworkSlugs,
          ...permissions
            .filter(permission => permission.startsWith(prefix))
            .map(permission => permission.substring(prefix.length))
        ];
      } else {
        // Other users have access to the frameworks embodied by their set of projects
        frameworkSlugs = [
          ...frameworkSlugs,
          ...(
            await (this as User).$get("projects", {
              attributes: [[fn("DISTINCT", col("Project.framework_key")), "frameworkKey"]],
              raw: true
            })
          )
            .map(({ frameworkKey }) => frameworkKey)
            .filter(frameworkKey => frameworkKey != null)
        ];
      }

      if (frameworkSlugs.length == 0) return (this._myFrameworks = []);

      frameworkSlugs = uniq(frameworkSlugs);
      return (this._myFrameworks = await Framework.findAll({
        where: { slug: { [Op.in]: frameworkSlugs } }
      }));
    }

    return this._myFrameworks;
  }
}
