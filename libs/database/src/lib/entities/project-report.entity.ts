import {
  AllowNull,
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
import { BIGINT, DATE, INTEGER, STRING, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Project } from "./project.entity";

// A quick stub for the tree endpoints
@Table({ tableName: "v2_project_reports", underscored: true, paranoid: true })
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];

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

  @Column(STRING)
  status: string;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftMen: number | null;

  @AllowNull
  // There is also an `ft_jobs_youth` field, but it appears to be unused.
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ unsigned: true, length: 10 }), field: "ft_jobs_non_youth" })
  ftNonYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptNonYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerNonYouth: number | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: "App\\Models\\V2\\Projects\\ProjectReport", collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;
}
