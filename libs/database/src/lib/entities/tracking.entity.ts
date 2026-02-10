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
import { TrackingEntry } from "./tracking-entry.entity";
import { Literal } from "sequelize/types/utils";
import { Subquery } from "../util/subquery.builder";
import { TrackingDomain, TrackingType } from "../types/tracking";
import { LaravelModel, laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  forModel: (model: LaravelModel) => ({
    where: {
      trackableType: laravelType(model),
      trackableId: model.id
    }
  }),
  forAll: (models: LaravelModel[]) => ({
    where: {
      [Op.or]: models.map(model => ({
        trackableType: laravelType(model),
        trackableId: model.id
      }))
    }
  }),
  domain: (domain: TrackingDomain) => ({ where: { domain } }),
  type: (type: TrackingType) => ({ where: { type } }),
  collection: (collection: string) => ({ where: { collection } })
}))
@Table({
  tableName: "trackings",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "trackings_morph_index", fields: ["trackable_id", "trackable_type"] }
  ]
})
export class Tracking extends Model<InferAttributes<Tracking>, InferCreationAttributes<Tracking>> {
  static readonly POLYMORPHIC_TYPE = "trackableType";
  static readonly POLYMORPHIC_ID = "trackableId";

  static readonly DEMOGRAPHIC_COUNT_CUTOFF = "2024-07-05";

  static readonly DOMAINS = ["demographics", "restoration"] as const;

  static readonly WORKDAYS_TYPE = "workdays";
  static readonly RESTORATION_PARTNERS_TYPE = "restoration-partners";
  static readonly JOBS_TYPE = "jobs";
  static readonly EMPLOYEES_TYPE = "employees";
  static readonly VOLUNTEERS_TYPE = "volunteers";
  static readonly ALL_BENEFICIARIES_TYPE = "all-beneficiaries";
  static readonly TRAINING_BENEFICIARIES_TYPE = "training-beneficiaries";
  static readonly INDIRECT_BENEFICIARIES_TYPE = "indirect-beneficiaries";
  static readonly ASSOCIATES_TYPES = "associates";
  static readonly DEMOGRAPHICS_TYPES = [
    Tracking.WORKDAYS_TYPE,
    Tracking.RESTORATION_PARTNERS_TYPE,
    Tracking.JOBS_TYPE,
    Tracking.EMPLOYEES_TYPE,
    Tracking.VOLUNTEERS_TYPE,
    Tracking.ALL_BENEFICIARIES_TYPE,
    Tracking.TRAINING_BENEFICIARIES_TYPE,
    Tracking.INDIRECT_BENEFICIARIES_TYPE,
    Tracking.ASSOCIATES_TYPES
  ] as const;

  static readonly TREES_TYPE = "trees";
  static readonly HECTARES_TYPE = "hectares";
  static readonly RESTORATION_TYPES = [Tracking.TREES_TYPE, Tracking.HECTARES_TYPE] as const;

  // All values that are valid for the `type` field across domains.
  static readonly VALID_TYPES = [...Tracking.DEMOGRAPHICS_TYPES, ...Tracking.RESTORATION_TYPES] as const;

  static for(model: LaravelModel) {
    return chainScope(this, "forModel", model) as typeof Tracking;
  }

  /**
   * Will pull trackings for all associated models.
   *
   * NOTE: This scope adds a [Op.or] clause to the final WHERE clause, and due to how sequelize
   * combines clauses, any ORs added to the final findAll() call will overwrite this one. Use
   * with caution!
   */
  static forAll(models: LaravelModel[]) {
    return chainScope(this, "forAll", models) as typeof Tracking;
  }

  static domain(domain: TrackingDomain) {
    return chainScope(this, "domain", domain) as typeof Tracking;
  }

  static type(type: TrackingType) {
    return chainScope(this, "type", type) as typeof Tracking;
  }

  static collection(collection: string) {
    return chainScope(this, "collection", collection) as typeof Tracking;
  }

  static idsSubquery(
    trackableIds: Literal | number[],
    trackableType: string,
    options: { type?: TrackingType; domain?: TrackingDomain } = {}
  ) {
    const query = Subquery.select(Tracking, "id")
      .eq("trackableType", trackableType)
      .in("trackableId", trackableIds)
      .eq("hidden", false);

    if (options.domain != null) query.eq("domain", options.domain);
    if (options.type != null) query.eq("type", options.type);

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
  domain: TrackingDomain;

  @Column(STRING)
  type: TrackingType;

  // Note: this allows null in the current schema, but the only rows with a null value have been soft deleted.
  // This column will be made non-nullable in a future update.
  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(STRING)
  trackableType: string;

  @Column(BIGINT.UNSIGNED)
  trackableId: number;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: CreationOptional<boolean>;

  @HasMany(() => TrackingEntry, { constraints: false })
  entries: TrackingEntry[] | null;
}
