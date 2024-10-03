import { AutoIncrement, Column, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { BIGINT, QueryTypes } from 'sequelize';

@Table({ tableName: 'roles', underscored: true })
export class Role extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT({ unsigned: true }) })
  override id: bigint;

  @Column
  name: string;

  @Column
  guardName: string;

  /**
   * Gets the list of role names that the given user has assigned in the DB. This is done as a raw
   * query because we don't need to represent most of these Entities in this codebase, and without
   * those models represented, the ManyToOne and OneToMany associations can't be represented.
   */
  public static async getUserRoleNames(userId: number): Promise<string[]> {
    const roles = (await this.sequelize?.query(
      `
        SELECT roles.name FROM roles
        INNER JOIN model_has_roles ON model_has_roles.role_id = roles.id
        WHERE
            model_has_roles.model_type = :modelType AND
            model_has_roles.model_id = :modelId
    `,
      {
        replacements: { modelType: 'App\\Models\\V2\\User', modelId: userId },
        type: QueryTypes.SELECT,
      }
    )) as { name: string }[];

    return roles?.map(({ name }) => name) ?? [];
  }
}
