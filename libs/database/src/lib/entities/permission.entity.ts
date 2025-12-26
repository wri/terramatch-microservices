import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, Op, QueryTypes, STRING } from "sequelize";
import { User } from "./user.entity";
import { PERMISSIONS, ROLES, Permission as PermissionName } from "../constants/permissions";
import { Role } from "./role.entity";
import { RoleHasPermission } from "./role-has-permission.entity";
import { flatten, uniq } from "lodash";

@Table({ tableName: "permissions", underscored: true })
export class Permission extends Model<InferAttributes<Permission>, InferCreationAttributes<Permission>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Column(STRING)
  name: string;

  @Column({ type: STRING, defaultValue: "api" })
  guardName: CreationOptional<string>;

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
        replacements: { modelType: User.LARAVEL_TYPE, modelId: userId },
        type: QueryTypes.SELECT
      }
    )) as { name: string }[];

    return permissions?.map(({ name }) => name) ?? [];
  }

  /**
   * Syncs the Role / Permissions defined in permissions.ts with what's in the DB. For now, the DB
   * record is the source of truth, and the configuration in permissions.ts is only referenced for
   * this sync process.
   *
   * Once we have fully decommissioned the PHP codebase, it may make sense to drop the permissions
   * table and simplify the system by only assigning roles to users and letting the configuration
   * dictate which permissions they then have access to.
   */
  public static async syncPermissions() {
    // First, check that all the permissions specified in the ROLES constant are included in PERMISSIONS
    const configRolePermissions = uniq(flatten(Object.values(ROLES)));
    const missingConfigPermissions = configRolePermissions.filter(
      permission => !Object.keys(PERMISSIONS).includes(permission)
    );
    if (missingConfigPermissions.length > 0) {
      throw new Error(
        `Some roles have permissions that do not exist in the permissions config [${missingConfigPermissions.join(
          ", "
        )}]`
      );
    }

    const dbPermissionNames = (await Permission.findAll({ attributes: ["name"] })).map(({ name }) => name);
    const configPermissionNames = Object.keys(PERMISSIONS);
    const permissionsToAdd = configPermissionNames.filter(permission => !dbPermissionNames.includes(permission));
    if (permissionsToAdd.length > 0) {
      await Permission.bulkCreate(permissionsToAdd.map(name => ({ name })));
    }

    const permissionsToRemove = dbPermissionNames.filter(permission => !configPermissionNames.includes(permission));
    if (permissionsToRemove.length > 0) {
      await Permission.destroy({ where: { name: permissionsToRemove } });
    }

    // these tables are all tiny, so let's just fetch all the data, figure it out in memory and then sync to the DB.
    const dbRoles = await Role.findAll();
    const dbPermissions = await Permission.findAll();
    const rolePermissions = await RoleHasPermission.findAll();
    const rolesSynced: string[] = [];
    for (const [role, permissions] of Object.entries(ROLES)) {
      rolesSynced.push(role);

      let dbRole = dbRoles.find(({ name }) => name === role);
      if (dbRole == null) {
        dbRole = await Role.create({ name: role });
      }

      const currentPermissions = rolePermissions.filter(({ roleId }) => roleId === dbRole.id);
      const requiredPermissions = dbPermissions.filter(({ name }) => permissions.includes(name as PermissionName));
      const rolePermissionsToAdd = requiredPermissions.filter(
        ({ id }) => currentPermissions.find(({ permissionId }) => permissionId === id) == null
      );
      if (rolePermissionsToAdd.length > 0) {
        await RoleHasPermission.bulkCreate(
          rolePermissionsToAdd.map(({ id }) => ({ roleId: dbRole.id, permissionId: id }))
        );
      }

      if (currentPermissions.length + rolePermissionsToAdd.length !== requiredPermissions.length) {
        await RoleHasPermission.destroy({
          where: { roleId: dbRole.id, permissionId: { [Op.notIn]: requiredPermissions.map(({ id }) => id) } }
        });
      }
    }

    const rolesToRemove = dbRoles.filter(({ name }) => !rolesSynced.includes(name)).map(({ id }) => id as number);
    if (rolesToRemove.length > 0) {
      await RoleHasPermission.destroy({ where: { roleId: rolesToRemove } });
      await Role.destroy({ where: { id: rolesToRemove } });
    }
  }
}
