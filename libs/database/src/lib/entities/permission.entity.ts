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
    const permissions = await this.createQueryBuilder('permissions')
      .innerJoin('role_has_permissions', 'role_has_permissions', 'role_has_permissions.permission_id = permissions.id')
      .innerJoin('roles', 'roles', 'roles.id = role_has_permissions.role_id')
      .innerJoin('model_has_roles', 'model_has_roles', 'model_has_roles.role_id = roles.id')
      .where(
        'model_has_roles.model_type = :modelType AND model_has_roles.model_id = :modelId',
        { modelType: "App\\Models\\V2\\User", modelId: userId }
      )
      .select('permissions.name')
      .getMany();
    return permissions.map(({ name }) =>  name);
  }
}
