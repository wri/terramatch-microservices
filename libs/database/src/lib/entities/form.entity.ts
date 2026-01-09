import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, INTEGER, literal, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { FrameworkKey } from "../constants";
import { Stage } from "./stage.entity";
import { FormType } from "../constants/forms";
import { FormSection } from "./form-section.entity";
import { FormQuestion } from "./form-question.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { EntityModel } from "../constants/entities";
import { FinancialReport } from "./financial-report.entity";
import { DisturbanceReport } from "./disturbance-report.entity";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";
import { SrpReport } from "./srp-report.entity";
import { InternalServerErrorException } from "@nestjs/common";

type FormMedia = "banner";

@Scopes(() => ({
  entity: (entity: EntityModel) => {
    if (entity instanceof FinancialReport) {
      if (entity.organisation?.type == null) {
        throw new InternalServerErrorException("Cannot determine form for financial report without organisation type.");
      }
      if (entity.organisation.type === "non-profit-organization") {
        return { where: { [Op.and]: [{ type: "financial-report" }, literal("LOWER(title) LIKE '%non%profit%'")] } };
      } else {
        return {
          where: { [Op.and]: [{ type: "financial-report" }, literal("LOWER(title) NOT LIKE '%non%profit%'")] }
        };
      }
    }
    if (entity instanceof DisturbanceReport) return { where: { type: "disturbance-report" } };
    if (entity instanceof SrpReport) return { where: { type: "srp-report" } };

    return { where: { model: laravelType(entity), frameworkKey: entity.frameworkKey } };
  }
}))
@Table({
  tableName: "forms",
  underscored: true,
  paranoid: true,
  hooks: {
    async beforeDestroy(form: Form) {
      // Handle deleting all questions and sections in 2 queries and avoid N+1 cascading by forcing
      // hooks off.
      await FormQuestion.forForm(form.uuid).destroy({ hooks: false });
      await FormSection.destroy({ where: { formId: form.uuid }, hooks: false });
    }
  }
})
export class Form extends Model<Form> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\Form";

  static readonly MEDIA: Record<FormMedia, MediaConfiguration> = {
    banner: { dbCollection: "banner", multiple: false, validation: "cover-image-with-svg" }
  };

  static for(entity: EntityModel) {
    return chainScope(this, "entity", entity) as typeof Form;
  }

  static readonly I18N_FIELDS = ["title", "subtitle", "description", "submissionMessage"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @AllowNull
  @Column(STRING)
  model: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  override version: number;

  @AllowNull
  @Column(STRING)
  type: FormType | null;

  @Column(TEXT)
  title: string;

  @AllowNull
  @Column(INTEGER)
  titleId: number | null;

  @AllowNull
  @Column(TEXT)
  subtitle: string | null;

  @AllowNull
  @Column(INTEGER)
  subtitleId: number | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  descriptionId: number | null;

  @AllowNull
  @Column(TEXT)
  documentation: string | null;

  @AllowNull
  @Column(TEXT)
  submissionMessage: string | null;

  @AllowNull
  @Column(INTEGER)
  submissionMessageId: number | null;

  @AllowNull
  @Column(TEXT)
  duration: string | null;

  @Column(BOOLEAN)
  published: boolean;

  @AllowNull
  @Column(UUID)
  stageId: string | null;

  @BelongsTo(() => Stage, { foreignKey: "stageId", targetKey: "uuid", constraints: false })
  stage: Stage | null;

  @Column(STRING)
  updatedBy: string | null;

  @AllowNull
  @Column(DATE)
  deadlineAt: Date | null;

  @AllowNull
  @Column(STRING)
  documentationLabel: string | null;
}
