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
  treeSpecies: TreeSpecies[] | null;

  async loadTreeSpecies() {
    if (this.treeSpecies == null) {
      this.treeSpecies = await this.$get("treeSpecies");
    }
    return this.treeSpecies;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: "App\\Models\\V2\\Sites\\Site", collection: "non-tree" }
  })
  nonTreeSpecies: TreeSpecies[] | null;

  async loadNonTreeSpecies() {
    if (this.nonTreeSpecies == null) {
      this.nonTreeSpecies = await this.$get("nonTreeSpecies");
    }
    return this.nonTreeSpecies;
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
