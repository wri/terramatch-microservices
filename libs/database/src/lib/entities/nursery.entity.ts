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
import { BIGINT, literal, STRING, UUID } from "sequelize";
import { Project } from "./project.entity";
import { TreeSpecies } from "./tree-species.entity";
import { NurseryReport } from "./nursery-report.entity";
import { EntityStatus, UpdateRequestStatus } from "../constants/status";

// Incomplete stub
@Table({ tableName: "v2_nurseries", underscored: true, paranoid: true })
export class Nursery extends Model<Nursery> {
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\Nursery";

  static approvedIdsSubquery(projectIdReplacement = ":projectId") {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const deletedAt = Nursery.getAttributes().deletedAt!.field;
    return literal(
      `(SELECT ${Nursery.getAttributes().id.field} FROM ${Nursery.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${Nursery.getAttributes().projectId.field} = ${projectIdReplacement}
        AND ${Nursery.getAttributes().status.field} IN (${Nursery.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  status: EntityStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Nursery.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;

  @HasMany(() => NurseryReport)
  reports: NurseryReport[] | null;
}
