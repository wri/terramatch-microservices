import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, Op, STRING } from "sequelize";
import { PERMISSIONS, ROLES, Permission as PermissionName } from "../constants/permissions";
import { Role } from "./role.entity";
import { RoleHasPermission } from "./role-has-permission.entity";
import { flatten, uniq } from "lodash";

@Table({ tableName: "permissions", underscored: true })
export class Permission extends Model<InferAttributes<Permission>, InferCreationAttributes<Permission>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Column(STRING)
  declare name: string;

  @Column({ type: STRING, defaultValue: "api" })
  declare guardName: CreationOptional<string>;

  /**
   * Syncs the Role / Permissions defined in permissions.ts to the roles / permissions DB tables.
   *
   * @deprecated The DB tables are no longer read: user permissions are derived from `users.roles`
   *   and the configuration in permissions.ts directly.
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
    for (const [role, permissions] of Object.entries<readonly PermissionName[]>(ROLES)) {
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
