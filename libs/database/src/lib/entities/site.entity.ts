import {
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";

// A quick stub for the research endpoints
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: "App\\Models\\V2\\Sites\\Site", collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    if (this.treesPlanted == null) {
      this.treesPlanted = await this.$get("treesPlanted");
    }
    return this.treesPlanted;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: "App\\Models\\V2\\Sites\\Site", collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  async loadNonTrees() {
    if (this.nonTrees == null) {
      this.nonTrees = await this.$get("nonTrees");
    }
    return this.nonTrees;
  }

  @HasMany(() => SiteReport)
  reports: SiteReport[] | null;

  async loadReports() {
    if (this.reports == null) {
      this.reports = await this.$get("reports");
    }
    return this.reports;
  }
}
