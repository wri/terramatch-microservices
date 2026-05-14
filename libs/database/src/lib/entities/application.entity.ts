import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, UUID, UUIDV4 } from "sequelize";
import { User } from "./user.entity";
import { FormSubmission } from "./form-submission.entity";
import { FundingProgramme } from "./funding-programme.entity";
import { Organisation } from "./organisation.entity";

@Table({
  tableName: "applications",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [{ name: "applications_funding_programme_uuid_index", fields: ["funding_programme_uuid"] }]
})
export class Application extends Model<InferAttributes<Application>, InferCreationAttributes<Application>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @AllowNull
  @Column(UUID)
  declare fundingProgrammeUuid: string | null;

  @BelongsTo(() => FundingProgramme, { foreignKey: "fundingProgrammeUuid", targetKey: "uuid" })
  declare fundingProgramme: FundingProgramme | null;

  get fundingProgrammeName() {
    return this.fundingProgramme?.name ?? null;
  }

  @AllowNull
  @Column(UUID)
  declare organisationUuid: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationUuid", targetKey: "uuid" })
  declare organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name;
  }

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare updatedBy: number | null;

  @HasMany(() => FormSubmission)
  declare formSubmissions: FormSubmission[] | null;

  get projectPitchUuid() {
    return this.formSubmissions?.[0]?.projectPitchUuid ?? null;
  }
}
