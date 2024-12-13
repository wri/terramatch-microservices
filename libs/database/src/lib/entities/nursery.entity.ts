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
import { Project } from "./project.entity";
import { TreeSpecies } from "./tree-species.entity";
import { NurseryReport } from "./nursery-report.entity";

// A quick stub for the tree service endpoints.
@Table({ tableName: "v2_nurseries", underscored: true, paranoid: true })
export class Nursery extends Model<Nursery> {
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
    scope: { speciesableType: "App\\Models\\V2\\Nurseries\\Nursery", collection: "nursery-seedling" }
  })
  treeSpecies: TreeSpecies[] | null;

  async loadTreeSpecies() {
    if (this.treeSpecies == null) {
      this.treeSpecies = await this.$get("treeSpecies");
    }
    return this.treeSpecies;
  }

  @HasMany(() => NurseryReport)
  reports: NurseryReport[] | null;
}
