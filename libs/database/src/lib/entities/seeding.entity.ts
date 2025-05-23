import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DOUBLE, Op, STRING, UUID, UUIDV4 } from "sequelize";
import { TreeSpeciesResearch } from "./tree-species-research.entity";
import { Literal } from "sequelize/types/utils";
import { SiteReport } from "./site-report.entity";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  visible: { where: { hidden: false } },
  siteReports: (ids: number[] | Literal) => ({
    where: {
      seedableType: SiteReport.LARAVEL_TYPE,
      seedableId: { [Op.in]: ids }
    }
  })
}))
@Table({
  tableName: "v2_seedings",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [{ name: "v2_seedings_morph_index", fields: ["seedable_id", "seedable_type"] }]
})
export class Seeding extends Model<Seeding> {
  static visible() {
    return chainScope(this, "visible") as typeof Seeding;
  }

  static siteReports(ids: number[] | Literal) {
    return chainScope(this, "siteReports", ids) as typeof Seeding;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @ForeignKey(() => TreeSpeciesResearch)
  @Column(STRING)
  taxonId: string | null;

  @AllowNull
  @Column(BIGINT)
  amount: number | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @AllowNull
  @Column(DOUBLE)
  weightOfSample: number | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  seedsInSample: number | null;

  @Column(STRING)
  seedableType: string;

  @Column(BIGINT.UNSIGNED)
  seedableId: number;
}
