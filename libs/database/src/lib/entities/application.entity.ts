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
import { BIGINT, UUID, UUIDV4 } from "sequelize";
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
export class Application extends Model<Application> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(UUID)
  fundingProgrammeUuid: string | null;

  @BelongsTo(() => FundingProgramme, { foreignKey: "fundingProgrammeUuid", targetKey: "uuid" })
  fundingProgramme: FundingProgramme | null;

  get fundingProgrammeName() {
    return this.fundingProgramme?.name ?? null;
  }

  @AllowNull
  @Column(UUID)
  organisationUuid: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationUuid", targetKey: "uuid" })
  organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name;
  }

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  updatedBy: number | null;

  @HasMany(() => FormSubmission)
  formSubmissions: FormSubmission[] | null;

  get projectPitchUuid() {
    return this.formSubmissions?.[0]?.projectPitchUuid ?? null;
  }
}
