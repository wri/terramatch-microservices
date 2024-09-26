import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'permissions' })
export class Permission extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @Column()
  name: string;

  @Column({ name: 'guard_name' })
  guardName: string;

  /**
   * Gets the list of permission names that the given user has access to through the roles that are
   * assigned to them. This is done as a raw query because we don't need to represent most of these
   * models as Entities in this codebase, and without those models represented, the ManyToOne and
   * OneToMany associations can't be represented.
   *
   * Note: This ignores permissions that are assigned directly to the user. We are not currently
   * using that capability, but if we started to, this would need to be more complicated.
   */
  public static async getUserPermissionNames(userId: number): Promise<string[]> {
    const permissions = await this.createQueryBuilder('p')
      .innerJoin('role_has_permissions', 'rhp', 'rhp.permission_id = p.id')
      .innerJoin('roles', 'r', 'r.id = rhp.role_id')
      .innerJoin('model_has_roles', 'mhr', 'mhr.role_id = r.id')
      .where('mhr.model_type = :modelType', { modelType: "App\\Models\\V2\\User" })
      .andWhere('mhr.model_id = :modelId', { modelId: userId })
      .select('p.name')
      .getMany();
    return permissions.map(({ name }) => name);
  }
}
