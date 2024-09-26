import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'roles' })
export class Role extends BaseEntity {
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
   * Gets the list of role names that the given user has assigned in the DB. This is done as a raw
   * query because we don't need to represent most of these Entities in this codebase, and without
   * those models represented, the ManyToOne and OneToMany associations can't be represented.
   */
  public static async getUserRoleNames(userId: number): Promise<string[]> {
    const roles = await this.createQueryBuilder('r')
      .innerJoin('model_has_roles', 'mhr', 'mhr.role_id = r.id')
      .where('mhr.model_type = :modelType', { modelType: "App\\Models\\V2\\User" })
      .andWhere('mhr.model_id = :modelId', { modelId: userId })
      .select('r.name')
      .getMany();
    return roles.map(({ name }) => name);
  }
}
