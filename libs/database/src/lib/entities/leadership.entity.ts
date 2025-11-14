import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  STRING,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { Organisation } from "./organisation.entity";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  organisation: (orgId: number) => ({ where: { organisationId: orgId } }),
  collection: (collection: string) => ({ where: { collection: collection } })
}))
@Table({ tableName: "leaderships", underscored: true, paranoid: true })
export class Leadership extends Model<InferAttributes<Leadership>, InferCreationAttributes<Leadership>> {
  static organisation(orgId: number) {
    return chainScope(this, "organisation", orgId) as typeof Leadership;
  }

  static collection(collection: string) {
    return chainScope(this, "collection", collection) as typeof Leadership;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @BelongsTo(() => Organisation)
  organisation: NonAttribute<Organisation | null>;

  @Column(STRING)
  collection: string;

  @AllowNull
  @Column(STRING)
  firstName: string | null;

  @AllowNull
  @Column(STRING)
  lastName: string | null;

  @AllowNull
  @Column(STRING)
  position: string | null;

  @AllowNull
  @Column(STRING)
  gender: string | null;

  @AllowNull
  @Column(TINYINT.UNSIGNED)
  age: number | null;

  @AllowNull
  @Column(STRING)
  nationality: string | null;
}
