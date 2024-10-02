import { AllowNull, BelongsToMany, Column, Index, Model, Table } from 'sequelize-typescript';
import { BIGINT, UUID } from 'sequelize';
import { Role } from './role.entity';
import { ModelHasRole } from './model-has-role.entity';

@Table({ tableName: 'users', underscored: true, paranoid: true })
export class User extends Model {
  // There are many rows in the prod DB without a UUID assigned, so this cannot be a unique
  // index until that is fixed.
  @Column({ type: UUID, allowNull: true })
  @Index({ unique: false })
  uuid: string | null;

  @Column({ type: BIGINT({ unsigned: true }), allowNull: true })
  organisationId: number | null;

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
        modelType: "App\\Models\\V2\\User"
      }
    }
  })
  roles: Role[];

  /**
   * Depends on `roles` being loaded, either through include: [Role] on the find call, or by
   * await user.$get('roles');
   */
  get primaryRole() {
    return this.roles?.[0]?.name;
  }


  // @OneToOne(() => Organisation, { allowNull: true })
  // @JoinColumn({ name: 'organisation_id' })
  // organisation: Promise<Organisation | null>;
  //
  // organisations() {
  //   return Organisation.createQueryBuilder('o')
  //     .innerJoin('organisation_user', 'ou', 'ou.organisation_id = o.id')
  //     .where('ou.user_id = :userId', { userId: this.id });
  // }
  //
  // organisationsConfirmed() {
  //   return this.organisations().andWhere('ou.status = :status', {
  //     status: 'approved',
  //   });
  // }
  //
  // organisationsRequested() {
  //   return this.organisations().andWhere('ou.status = :status', {
  //     status: 'requested',
  //   });
  // }
  //
  // private _primaryOrganisation: Organisation | false;
  // async primaryOrganisation() {
  //   if (this._primaryOrganisation == null) {
  //     let org = await this.organisation;
  //     if (org != null) return org;
  //
  //     org = await this.organisationsConfirmed().getOne();
  //     if (org != null) return org;
  //
  //     this._primaryOrganisation =
  //       (await this.organisationsRequested().getOne()) ?? false;
  //   }
  //
  //   return this._primaryOrganisation === false
  //     ? null
  //     : this._primaryOrganisation;
  // }

  // async frameworks(): Promise<{ name: string; slug: string }[]> {
  //   // TODO: Once the Framework and Project tables have been ported over, this should
  //   //  use those entities and associations instead of this set of raw SQL queries.
  //   const isAdmin =
  //     (await this.roles()).find((role) => role.startsWith('admin-')) != null;
  //
  //   let frameworkSlugs: string[];
  //   if (isAdmin) {
  //     // Admins have access to all frameworks their permissions say they do
  //     const permissions = await Permission.getUserPermissionNames(this.id);
  //     const offset = 'framework-'.length;
  //     frameworkSlugs = permissions
  //       .filter((permission) => permission.startsWith('framework-'))
  //       .map((permission) => permission.substring(offset));
  //   } else {
  //     // Other users have access to the frameworks embodied by their set of projects
  //     frameworkSlugs = (
  //       await Project.createQueryBuilder('p')
  //         .innerJoin('v2_project_users', 'pu', 'p.id = pu.project_id')
  //         .where('pu.user_id = :userId', { userId: this.id })
  //         .andWhere('p.deleted_at is null')
  //         .select('p.framework_key')
  //         .distinct()
  //         .getRawMany()
  //     ).map(({ framework_key }) => framework_key);
  //   }
  //
  //   return (
  //     await Framework.createQueryBuilder('f')
  //       .select(['slug', 'name'])
  //       .where({ slug: In(frameworkSlugs) })
  //       .getRawMany()
  //   ).map(({ slug, name }) => ({ slug, name }));
  // }
  //
  // async organisationUserStatus(): Promise<string | undefined> {
  //   const org = await this.primaryOrganisation();
  //   if (org == null) return undefined;
  //
  //   return (
  //     await OrganisationUser.findOne({
  //       where: { userId: this.id, organisationId: org.id },
  //     })
  //   )?.status;
  // }
}
