import {
  AllowNull,
  AutoIncrement,
  Column,
  HasMany,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Op,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { DemographicEntry } from "./demographic-entry.entity";
import { Literal } from "sequelize/types/utils";
import { Subquery } from "../util/subquery.builder";
import { DemographicType } from "../types/demographic";
import { LaravelModel, laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  forModels: (models: LaravelModel[]) => ({
    where: {
      [Op.or]: models.map(model => ({
        demographicalType: laravelType(model),
        demographicalId: model.id
      }))
    }
  }),
  collection: (collection: string) => ({ where: { collection } }),
  type: (type: DemographicType) => ({ where: { type } })
}))
@Table({
  tableName: "demographics",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "demographics_morph_index", fields: ["demographical_id", "demographical_type"] }
  ]
})
export class Demographic extends Model<InferAttributes<Demographic>, InferCreationAttributes<Demographic>> {
  static readonly POLYMORPHIC_TYPE = "demographicalType";
  static readonly POLYMORPHIC_ID = "demographicalId";

  static readonly DEMOGRAPHIC_COUNT_CUTOFF = "2024-07-05";

  static readonly WORKDAYS_TYPE = "workdays";
  static readonly RESTORATION_PARTNERS_TYPE = "restoration-partners";
  static readonly JOBS_TYPE = "jobs";
  static readonly EMPLOYEES_TYPE = "employees";
  static readonly VOLUNTEERS_TYPE = "volunteers";
  static readonly ALL_BENEFICIARIES_TYPE = "all-beneficiaries";
  static readonly TRAINING_BENEFICIARIES_TYPE = "training-beneficiaries";
  static readonly INDIRECT_BENEFICIARIES_TYPE = "indirect-beneficiaries";
  static readonly ASSOCIATES_TYPES = "associates";
  static readonly VALID_TYPES = [
    Demographic.WORKDAYS_TYPE,
    Demographic.RESTORATION_PARTNERS_TYPE,
    Demographic.JOBS_TYPE,
    Demographic.EMPLOYEES_TYPE,
    Demographic.VOLUNTEERS_TYPE,
    Demographic.ALL_BENEFICIARIES_TYPE,
    Demographic.TRAINING_BENEFICIARIES_TYPE,
    Demographic.INDIRECT_BENEFICIARIES_TYPE,
    Demographic.ASSOCIATES_TYPES
  ] as const;

  static for(models: LaravelModel | LaravelModel[]) {
    return chainScope(this, "forModels", Array.isArray(models) ? models : [models]) as typeof Demographic;
  }

  static type(type: DemographicType) {
    return chainScope(this, "type", type) as typeof Demographic;
  }

  static collection(collection: string) {
    return chainScope(this, "collection", collection) as typeof Demographic;
  }

  static idsSubquery(demographicalIds: Literal | number[], demographicalType: string, type?: DemographicType) {
    const query = Subquery.select(Demographic, "id")
      .eq("demographicalType", demographicalType)
      .in("demographicalId", demographicalIds)
      .eq("hidden", false);

    if (type != null) {
      query.eq("type", type);
    }

    return query.literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @Column(STRING)
  type: DemographicType;

  // Note: this allows null, but the only rows with a null value have been soft deleted.
  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(STRING)
  demographicalType: string;

  @Column(BIGINT.UNSIGNED)
  demographicalId: number;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: CreationOptional<boolean>;

  @HasMany(() => DemographicEntry, { constraints: false })
  entries: DemographicEntry[] | null;
}
