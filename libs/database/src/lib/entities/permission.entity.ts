import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, QueryTypes, STRING } from "sequelize";

@Table({ tableName: "permissions", underscored: true })
export class Permission extends Model<Permission> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  name: string;

  @Column(STRING)
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
    const permissions = (await this.sequelize?.query(
      `
        SELECT permissions.name FROM permissions
        INNER JOIN role_has_permissions ON role_has_permissions.permission_id = permissions.id
        INNER JOIN roles ON roles.id = role_has_permissions.role_id
        INNER JOIN model_has_roles ON model_has_roles.role_id = roles.id
        WHERE
            model_has_roles.model_type = :modelType AND
            model_has_roles.model_id = :modelId
    `,
      {
        replacements: { modelType: "App\\Models\\V2\\User", modelId: userId },
        type: QueryTypes.SELECT
      }
    )) as { name: string }[];

    return permissions?.map(({ name }) => name) ?? [];
  }
}
