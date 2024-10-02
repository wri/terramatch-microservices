import {
  Column,
  CreatedAt,
  DeletedAt,
  Index,
  Model,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BIGINT, UUID } from 'sequelize';
import { Role } from './role.entity';

@Table({ tableName: 'users' })
export class User extends Model {
  // There are many rows in the prod DB without a UUID assigned, so this cannot be a unique
  // index until that is fixed.
  @Column({ type: UUID, allowNull: true })
  @Index({ unique: false })
  uuid: string | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  override createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  override updatedAt: Date;

  @DeletedAt
  @Column({ field: 'deleted_at' })
  override deletedAt: Date;

  @Column({
    type: BIGINT({ unsigned: true }),
    field: 'organisation_id',
    allowNull: true,
  })
  organisationId: number | null;

  @Column({ field: 'first_name', allowNull: true })
  firstName: string | null;

  @Column({ field: 'last_name', allowNull: true })
  lastName: string | null;

  @Column({ field: 'email_address', unique: true })
  emailAddress: string;

  @Column({ allowNull: true })
  password: string | null;

  @Column({ field: 'email_address_verified_at', allowNull: true })
  emailAddressVerifiedAt: Date | null;

  @Column({ field: 'last_logged_in_at', allowNull: true })
  lastLoggedInAt: Date | null;

  @Column({ field: 'job_role', allowNull: true })
  jobRole: string | null;

  @Column({ allowNull: true })
  facebook: string | null;

  @Column({ allowNull: true })
  twitter: string | null;

  @Column({ allowNull: true })
  linkedin: string | null;

  @Column({ allowNull: true })
  instagram: string | null;

  @Column({ allowNull: true })
  avatar: string | null;

  @Column({ field: 'phone_number', allowNull: true })
  phoneNumber: string | null;

  @Column({ field: 'whatsapp_phone', allowNull: true })
  whatsappPhone: string | null;

  @Column({ field: 'is_subscribed', defaultValue: true })
  isSubscribed: boolean;

  @Column({ field: 'has_consented', defaultValue: true })
  hasConsented: boolean;

  @Column({ allowNull: true })
  banners: string | null;

  @Column({ field: 'api_key', allowNull: true })
  apiKey: string | null;

  @Column({ allowNull: true })
  country: string | null;

  @Column({ allowNull: true })
  program: string | null;

  @Column
  locale: string;

  // Relations

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
  ///
  //   return this._primaryOrganisation === false
  //     ? null
  //     : this._primaryOrganisation;
  // }

  // TODO: turn into a proper association in Sequelize
  private _roles: string[];
  async roles(): Promise<string[]> {
    if (this._roles == null) {
      this._roles = await Role.getUserRoleNames(this.id);
    }

    return this._roles;
  }

  async primaryRole() {
    return (await this.roles())?.[0];
  }

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
