import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, TEXT, UUID } from "sequelize";
import { DemographicEntry } from "./demographic-entry.entity";
import { Literal } from "sequelize/types/utils";
import { ProjectReport } from "./project-report.entity";
import { SiteReport } from "./site-report.entity";
import { Dictionary } from "lodash";
import {
  BENEFICIARIES_PROJECT_COLLECTIONS,
  JOBS_PROJECT_COLLECTIONS,
  RESTORATION_PARTNERS_PROJECT_COLLECTIONS,
  VOLUNTEERS_PROJECT_COLLECTIONS,
  WORKDAYS_PROJECT_COLLECTIONS,
  WORKDAYS_SITE_COLLECTIONS
} from "../constants/demographic-collections";
import { Subquery } from "../util/subquery.builder";
import { DemographicType } from "../types/demographic";

@Table({
  tableName: "demographics",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "demographics_morph_index", fields: ["demographical_id", "demographical_type"] }
  ]
})
export class Demographic extends Model<Demographic> {
  static readonly DEMOGRAPHIC_COUNT_CUTOFF = "2024-07-05";

  static readonly WORKDAYS_TYPE = "workdays";
  static readonly RESTORATION_PARTNERS_TYPE = "restoration-partners";
  static readonly JOBS_TYPE = "jobs";
  static readonly VOLUNTEERS_TYPE = "volunteers";
  static readonly BENEFICIARIES_TYPE = "beneficiaries";
  static readonly VALID_TYPES = [
    Demographic.WORKDAYS_TYPE,
    Demographic.RESTORATION_PARTNERS_TYPE,
    Demographic.JOBS_TYPE,
    Demographic.VOLUNTEERS_TYPE,
    Demographic.BENEFICIARIES_TYPE
  ] as const;

  static readonly COLLECTION_MAPPING: Dictionary<Dictionary<Dictionary<string>>> = {
    [ProjectReport.LARAVEL_TYPE]: {
      [Demographic.WORKDAYS_TYPE]: WORKDAYS_PROJECT_COLLECTIONS,
      [Demographic.RESTORATION_PARTNERS_TYPE]: RESTORATION_PARTNERS_PROJECT_COLLECTIONS,
      [Demographic.JOBS_TYPE]: JOBS_PROJECT_COLLECTIONS,
      [Demographic.VOLUNTEERS_TYPE]: VOLUNTEERS_PROJECT_COLLECTIONS,
      [Demographic.BENEFICIARIES_TYPE]: BENEFICIARIES_PROJECT_COLLECTIONS
    },
    [SiteReport.LARAVEL_TYPE]: {
      [Demographic.WORKDAYS_TYPE]: WORKDAYS_SITE_COLLECTIONS
    }
  };

  static idsSubquery(demographicalIds: Literal, demographicalType: string, type: DemographicType) {
    return Subquery.select(Demographic, "id")
      .eq("demographicalType", demographicalType)
      .in("demographicalId", demographicalIds)
      .eq("hidden", false)
      .eq("type", type).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  get collectionTitle(): string {
    return (
      (this.collection && Demographic.COLLECTION_MAPPING[this.demographicalType]?.[this.type]?.[this.collection]) ??
      "Unknown"
    );
  }

  @Column(STRING)
  demographicalType: string;

  @Column(BIGINT.UNSIGNED)
  demographicalId: number;

  @AllowNull
  @Column(TEXT)
  description: string;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @HasMany(() => DemographicEntry, { constraints: false })
  entries: DemographicEntry[] | null;
}
