import { AutoIncrement, Column, ForeignKey, HasMany, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
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

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    scope: { speciesableType: "App\\Models\\V2\\Sites\\Site" }
  })
  treeSpecies: TreeSpecies[] | null;

  async loadTreeSpecies() {
    if (this.treeSpecies == null) {
      this.treeSpecies = await this.$get("treeSpecies");
    }
    return this.treeSpecies;
  }

  @HasMany(() => SiteReport)
  siteReports: SiteReport[] | null;

  async loadSiteReports() {
    if (this.siteReports == null) {
      this.siteReports = await this.$get("siteReports");
    }
    return this.siteReports;
  }
}
