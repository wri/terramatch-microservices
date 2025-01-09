import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";

// Incomplete stub
@Table({ tableName: "project_pitches", underscored: true, paranoid: true })
export class ProjectPitch extends Model<ProjectPitch> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\ProjectPitch";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;
}
