import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Site } from "./site.entity";

// A quick stub for the research endpoints
@Table({ tableName: "v2_site_reports", underscored: true, paranoid: true })
export class SiteReport extends Model<SiteReport> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @ForeignKey(() => Site)
  @Column(BIGINT.UNSIGNED)
  siteId: number;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(DATE)
  submittedAt: Date | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    scope: { speciesableType: "App\\Models\\V2\\Sites\\SiteReport" }
  })
  treeSpecies: TreeSpecies[] | null;

  async loadTreeSpecies() {
    if (this.treeSpecies == null) {
      this.treeSpecies = await this.$get("treeSpecies");
    }
    return this.treeSpecies;
  }
}
