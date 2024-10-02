import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  ForeignKey,
  Index,
  Model,
  Table,
} from 'sequelize-typescript';
import { col, fn, Op, UUID } from 'sequelize';
import { Role } from './role.entity';
import { ModelHasRole } from './model-has-role.entity';
import { Permission } from './permission.entity';
import { Framework } from './framework.entity';
import { Project } from './project.entity';
import { ProjectUser } from './project-user.entity';
import { Organisation } from './organisation.entity';
import { OrganisationUser } from './organisation-user.entity';

@Table({ tableName: 'users', underscored: true, paranoid: true })
export class User extends Model {
  // There are many rows in the prod DB without a UUID assigned, so this cannot be a unique
  // index until that is fixed.
  @Column({ type: UUID, allowNull: true })
  @Index({ unique: false })
  uuid: string | null;

  @ForeignKey(() => Organisation)
  @AllowNull
  @Column
  organisationId: bigint | null;

  @AllowNull
  @Column
  firstName: string | null;

  @AllowNull
  @Column
  lastName: string | null;

  @AllowNull
  @Column({ unique: true })
  emailAddress: string;

  @AllowNull
  @Column
  password: string | null;

  @AllowNull
  @Column
  emailAddressVerifiedAt: Date | null;

  @AllowNull
  @Column
  lastLoggedInAt: Date | null;

  @AllowNull
  @Column
  jobRole: string | null;

  @AllowNull
  @Column
  facebook: string | null;

  @AllowNull
  @Column
  twitter: string | null;

  @AllowNull
  @Column
  linkedin: string | null;

  @AllowNull
  @Column
  instagram: string | null;

  @AllowNull
  @Column
  avatar: string | null;

  @AllowNull
  @Column
  phoneNumber: string | null;

  @AllowNull
  @Column
  whatsappPhone: string | null;

  @Column({ defaultValue: true })
  isSubscribed: boolean;

  @Column({ defaultValue: true })
  hasConsented: boolean;

  @AllowNull
  @Column
  banners: string | null;

  @AllowNull
  @Column
  apiKey: string | null;

  @AllowNull
  @Column
  country: string | null;

  @AllowNull
  @Column
  program: string | null;

  @Column
  locale: string;

  @BelongsToMany(() => Role, {
    foreignKey: 'modelId',
    through: {
      model: () => ModelHasRole,
      unique: false,
      scope: {
        modelType: 'App\\Models\\V2\\User',
      },
    },
  })
  roles: Role[];

  async loadRoles() {
    if (this.roles == null) this.roles = await (this as User).$get('roles');
    return this.roles;
  }

  /**
   * Depends on `roles` being loaded, either through include: [Role] on the find call, or by
   * await user.loadRoles()
   */
  get primaryRole() {
    return this.roles?.[0]?.name;
  }

  @BelongsToMany(() => Project, () => ProjectUser)
  projects: Project[];

  async loadProjects() {
    if (this.projects == null) {
      this.projects = await (this as User).$get('projects');
    }
    return this.projects;
  }

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  async loadOrganisation() {
    if (this.organisation == null && this.organisationId != null) {
      this.organisation = await (this as User).$get('organisation');
    }
    return this.organisation;
  }

  @BelongsToMany(() => Organisation, () => OrganisationUser)
  organisations: Array<Organisation & { OrganisationUser: OrganisationUser }>;

  async loadOrganisations() {
    if (this.organisations == null) {
      this.organisations = await (this as User).$get('organisations');
    }
    return this.organisations;
  }

  @BelongsToMany(() => Organisation, {
    through: {
      model: () => OrganisationUser,
      scope: { status: 'approved' },
    },
  })
  organisationsConfirmed: Array<
    Organisation & { OrganisationUser: OrganisationUser }
  >;

  async loadOrganisationsConfirmed() {
    if (this.organisationsConfirmed == null) {
      this.organisationsConfirmed = await (this as User).$get(
        'organisationsConfirmed'
      );
    }
    return this.organisationsConfirmed;
  }

  @BelongsToMany(() => Organisation, {
    through: {
      model: () => OrganisationUser,
      scope: { status: 'requested' },
    },
  })
  organisationsRequested: Array<
    Organisation & { OrganisationUser: OrganisationUser }
  >;

  async loadOrganisationsRequested() {
    if (this.organisationsRequested == null) {
      this.organisationsRequested = await (this as User).$get(
        'organisationsRequested',
      );
    }
    return this.organisationsRequested;
  }

  private _primaryOrganisation: (Organisation & { OrganisationUser?: OrganisationUser }) | false;
  async primaryOrganisation(): Promise<(Organisation & { OrganisationUser?: OrganisationUser }) | null> {
    if (this._primaryOrganisation == null) {
      await this.loadOrganisation();
      if (this.organisation != null) {
        const userOrg = (await (this as User).$get(
          'organisations',
          { limit: 1, where: { id: this.organisation.id } }
        ))[0];
        return this._primaryOrganisation = userOrg ?? this.organisation;
      }

      const confirmed = (await (this as User).$get('organisationsConfirmed', { limit: 1 }))[0];
      if (confirmed != null) {
        return this._primaryOrganisation = confirmed;
      }

      const requested = (await (this as User).$get('organisationsRequested', { limit: 1 }))[0];
      if (requested != null) {
        return this._primaryOrganisation = requested;
      }

      this._primaryOrganisation = false;
    }

    return this._primaryOrganisation === false ? null : this._primaryOrganisation;
  }

  async frameworks(): Promise<Framework[]> {
    await this.loadRoles();
    const isAdmin =
      this.roles.find(({ name }) => name.startsWith('admin-')) != null;

    let frameworkSlugs: string[];
    if (isAdmin) {
      // Admins have access to all frameworks their permissions say they do
      const permissions = await Permission.getUserPermissionNames(this.id);
      const offset = 'framework-'.length;
      frameworkSlugs = permissions
        .filter((permission) => permission.startsWith('framework-'))
        .map((permission) => permission.substring(offset));
    } else {
      // Other users have access to the frameworks embodied by their set of projects
      frameworkSlugs = (
        await (this as User).$get('projects', {
          attributes: [
            [fn('DISTINCT', col('Project.framework_key')), 'frameworkKey'],
          ],
          raw: true,
        })
      ).map(({ frameworkKey }) => frameworkKey);
    }

    if (frameworkSlugs.length == 0) return [];
    return await Framework.findAll({
      where: { slug: { [Op.in]: frameworkSlugs } },
    });
  }
}
