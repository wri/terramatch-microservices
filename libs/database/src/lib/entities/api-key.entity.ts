import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import {
  Attributes,
  BIGINT,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  Op,
  STRING
} from "sequelize";
import { InternalServerErrorException } from "@nestjs/common";
import { DateTime, DurationLike } from "luxon";
import crypto from "node:crypto";
import { User } from "./user.entity";

const DEFAULT_ROTATION_EXPIRATION: DurationLike = { weeks: 1 };

@Table({
  tableName: "api_keys",
  underscored: true,
  indexes: [{ name: "api_keys_key_unique", unique: true, fields: ["key"] }]
})
export class ApiKey extends Model<InferAttributes<ApiKey>, InferCreationAttributes<ApiKey>> {
  static get sql() {
    if (ApiKey.sequelize == null) {
      throw new InternalServerErrorException("ApiKey table not connected to Sequelize");
    }
    return ApiKey.sequelize;
  }

  static generateKey() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Finds the (non-deleted) user that owns the given key, if the key exists and has not expired.
   * If `attributes` is provided, only those user attributes are loaded; otherwise all are.
   */
  static async findUser(key: string, attributes?: (keyof Attributes<User>)[]) {
    const apiKey = await ApiKey.findOne({
      where: { key, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] },
      attributes: ["id"],
      include: [{ association: "user", attributes, required: true }]
    });
    return apiKey?.user ?? null;
  }

  /**
   * Sets the expiration of the user's currently non-expiring key(s) to `expiresIn` from now, and
   * creates a new key with no expiration. The new key is generated unless one is provided.
   * Resolves to the new key.
   */
  static async rotate(
    userId: number,
    {
      key = ApiKey.generateKey(),
      expiresIn = DEFAULT_ROTATION_EXPIRATION
    }: { key?: string; expiresIn?: DurationLike } = {}
  ) {
    return await ApiKey.sql.transaction(async transaction => {
      const expiresAt = DateTime.now().plus(expiresIn).toJSDate();
      await ApiKey.update({ expiresAt }, { where: { userId, expiresAt: null }, transaction });
      return await ApiKey.create({ userId, key }, { transaction });
    });
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @BelongsTo(() => User, { constraints: false })
  declare user: User | null;

  @Column(STRING)
  declare key: string;

  @AllowNull
  @Column(DATE)
  declare expiresAt: CreationOptional<Date | null>;
}
