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
import {
  BIGINT,
  BOOLEAN,
  col,
  CreationOptional,
  DATE,
  fn,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  Op,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { Framework } from "./framework.entity";
import { Project } from "./project.entity";
import { ProjectUser } from "./project-user.entity";
import { Organisation } from "./organisation.entity";
import { FrameworkUser } from "./framework-user.entity";
import { ValidLocale } from "../constants/locale";
import { isNotNull } from "../types/array";
import { FrameworkKey } from "../constants";
import { InternalServerErrorException } from "@nestjs/common";
import { JsonColumn } from "../decorators/json-column.decorator";
import { getPermissionsForRoles, Permission } from "../constants/permissions";

@Table({ tableName: "users", underscored: true, paranoid: true })
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\User";

  static get sql() {
    if (User.sequelize == null) {
      throw new InternalServerErrorException("User table not connected to Sequelize");
    }
    return User.sequelize;
  }

  static async findLocale(userId?: number) {
    return userId == null ? undefined : (await User.findOne({ where: { id: userId }, attributes: ["locale"] }))?.locale;
  }

  static async orgUuid(userId?: number): Promise<string | null> {
    if (userId == null) return null;

    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "organisationId"],
      include: [{ association: "organisation", attributes: ["uuid"] }]
    });
    return user?.organisation?.uuid ?? null;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  // There are many rows in the prod DB without a UUID assigned, so this cannot be a unique
  // index until that is fixed.
  @AllowNull
  @Index({ unique: false })
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string | null;

  @ForeignKey(() => Organisation)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number | null;

  @AllowNull
  @Column(STRING)
  declare firstName: string | null;

  @AllowNull
  @Column(STRING)
  declare lastName: string | null;

  @AllowNull
  @Unique
  @Column(STRING)
  declare emailAddress: string;

  @AllowNull
  @Column(STRING)
  declare password: string | null;

  @AllowNull
  @Column(DATE)
  declare emailAddressVerifiedAt: Date | null;

  @AllowNull
  @Column(DATE)
  declare lastLoggedInAt: Date | null;

  @AllowNull
  @Column(STRING)
  declare jobRole: string | null;

  @AllowNull
  @Column(STRING)
  declare facebook: string | null;

  @AllowNull
  @Column(STRING)
  declare twitter: string | null;

  @AllowNull
  @Column(STRING)
  declare linkedin: string | null;

  @AllowNull
  @Column(STRING)
  declare instagram: string | null;

  @AllowNull
  @Column(STRING)
  declare avatar: string | null;

  @AllowNull
  @Column(STRING)
  declare phoneNumber: string | null;

  @AllowNull
  @Column(STRING)
  declare whatsappPhone: string | null;

  @Default(true)
  @Column(BOOLEAN)
  declare isSubscribed: CreationOptional<boolean>;

  @Default(true)
  @Column(BOOLEAN)
  declare hasConsented: CreationOptional<boolean>;

  @AllowNull
  @Column(STRING)
  declare banners: string | null;

  /** @deprecated API keys now live in the api_keys table (see ApiKey). To be removed in TM-4131. */
  @AllowNull
  @Column(STRING)
  declare apiKey: string | null;

  @AllowNull
  @Column(STRING)
  declare country: string | null;

  @Column(STRING)
  declare locale: ValidLocale;

  @Default([])
  @JsonColumn()
  declare roles: CreationOptional<string[]>;

  /**
   * Loads the roles column if the user was fetched with an attributes list that excluded it.
   */
  async loadRoles(): Promise<string[]> {
    // The column is non-null, so null / undefined here means it was not included in the query.
    if (this.roles == null) await this.reload({ attributes: ["roles"] });
    return this.roles;
  }

  get permissions(): NonAttribute<Permission[]> {
    return getPermissionsForRoles(this.roles);
  }

  get canReviewPolygons(): NonAttribute<boolean> {
    return this.permissions.some(permission => permission === "projects-manage" || permission.startsWith("framework-"));
  }

  get fullName() {
    return this.firstName == null || this.lastName == null ? null : `${this.firstName} ${this.lastName}`;
  }

  getSourceFromRoles(): string {
    if (this.roles.includes("greenhouse-service-account")) {
      return "greenhouse";
    }

    if (this.roles.includes("research-service-account")) {
      return "research";
    }

    return "terramatch";
  }

  @BelongsToMany(() => Project, () => ProjectUser)
  declare projects: Array<Project & { ProjectUser: ProjectUser }> | null;

  @BelongsTo(() => Organisation)
  declare organisation: Organisation | null;

  async loadOrganisation() {
    if (this.organisation == null && this.organisationId != null) {
      this.organisation = await (this as User).$get("organisation");
    }
    return this.organisation;
  }

  @BelongsToMany(() => Framework, () => FrameworkUser)
  declare frameworks: Framework[] | null;

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
      const isAdmin = this.roles.some(role => role.startsWith("admin-"));

      await this.loadFrameworks();

      let frameworkSlugs = this.frameworks?.map(({ slug }) => slug).filter(isNotNull) ?? [];
      if (isAdmin) {
        // Admins have access to all frameworks their permissions say they do
        const prefix = "framework-";
        frameworkSlugs = [
          ...frameworkSlugs,
          ...this.permissions
            .filter(permission => permission.startsWith(prefix))
            .map(permission => permission.substring(prefix.length))
        ] as FrameworkKey[];
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
