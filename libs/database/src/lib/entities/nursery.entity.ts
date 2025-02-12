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
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, literal, Op, STRING, UUID } from "sequelize";
import { Project } from "./project.entity";
import { TreeSpecies } from "./tree-species.entity";
import { NurseryReport } from "./nursery-report.entity";
import { EntityStatus, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chainScope";

// Incomplete stub
@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } }),
  approved: { where: { status: { [Op.in]: Nursery.APPROVED_STATUSES } } }
}))
@Table({ tableName: "v2_nurseries", underscored: true, paranoid: true })
export class Nursery extends Model<Nursery> {
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\Nursery";

  static approved() {
    return chainScope(this, "approved") as typeof Nursery;
  }

  static project(id: number) {
    return chainScope(this, { method: ["project", id] }) as typeof Nursery;
  }

  static approvedIdsSubquery(projectId: number) {
    const attributes = Nursery.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Nursery.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.id.field} FROM ${Nursery.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.projectId.field} = ${sql.escape(projectId)}
        AND ${attributes.status.field} IN (${Nursery.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
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
