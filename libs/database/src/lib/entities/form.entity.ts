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
import { BIGINT, BOOLEAN, INTEGER, literal, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { FrameworkKey } from "../constants";
import { Stage } from "./stage.entity";
import { FormType } from "../constants/forms";
import { FormSection } from "./form-section.entity";
import { FormQuestion } from "./form-question.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { EntityModel } from "../constants/entities";
import { DisturbanceReport } from "./disturbance-report.entity";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";
import { SrpReport } from "./srp-report.entity";
import { InternalServerErrorException } from "@nestjs/common";
import { FinancialReport } from "./financial-report.entity";
import { Subquery } from "../util/subquery.builder";
import { removeMedia } from "../hooks/remove-media";
import { removeQuestionDependencies } from "../hooks/remove-question-dependencies";
import { Framework } from "./framework.entity";

type FormMedia = "banner";

type FormAttachment = {
  name: string;
  type: "fundingProgramme" | "framework" | "entity";
  adminId?: string | null;
};

@Scopes(() => ({
  entity: (entity: EntityModel) => {
    if (entity instanceof FinancialReport) {
      if (entity?.frameworkKey == null) {
        if (entity.organisation?.type == null) {
          throw new InternalServerErrorException(
            "Cannot determine form for financial report without organisation type."
          );
        }
        if (entity.organisation.type === "non-profit-organization") {
          return { where: { [Op.and]: [{ type: "financial-report" }, literal("LOWER(title) LIKE '%non%profit%'")] } };
        } else {
          return {
            where: { [Op.and]: [{ type: "financial-report" }, literal("LOWER(title) NOT LIKE '%non%profit%'")] }
          };
        }
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
    async afterDestroy(form: Form) {
      const questionIds = (await FormQuestion.forForm(form.uuid).findAll({ attributes: ["id"] })).map(({ id }) => id);
      await FormQuestion.forForm(form.uuid).destroy();
      await FormSection.destroy({ where: { formId: form.uuid } });
      if (form.stageId != null) {
        await Stage.destroy({ where: { id: form.stageId } });
      }

      await removeQuestionDependencies(questionIds);

      await removeMedia(form);
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

  static uuidFor(entity: EntityModel) {
    const select = Subquery.select(Form, "uuid");
    if (entity instanceof FinancialReport && entity.frameworkKey == null) {
      if (entity.organisation?.type == null) {
        throw new InternalServerErrorException("Cannot determine form for financial report without organisation type.");
      }
      if (entity.organisation.type === "non-profit-organization") {
        select.eq("type", "financial-report").andLiteral(literal("LOWER(title) LIKE '%non%profit%'"));
      } else {
        select.eq("type", "financial-report").andLiteral(literal("LOWER(title) NOT LIKE '%non%profit%'"));
      }
    } else if (entity instanceof DisturbanceReport) {
      select.eq("type", "disturbance-report");
    } else if (entity instanceof SrpReport) {
      select.eq("type", "srp-report");
    } else {
      if (entity.frameworkKey == null) {
        throw new InternalServerErrorException("Cannot determine form for entity without framework key.");
      }
      select.eq("model", laravelType(entity)).eq("frameworkKey", entity.frameworkKey);
    }

    return select.literal;
  }

  static readonly I18N_FIELDS = ["title", "subtitle", "description", "submissionMessage"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  @AllowNull
  @Column(STRING)
  declare model: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare version: number;

  @AllowNull
  @Column(STRING)
  declare type: FormType | null;

  @Column(TEXT)
  declare title: string;

  @AllowNull
  @Column(INTEGER)
  declare titleId: number | null;

  @AllowNull
  @Column(TEXT)
  declare subtitle: string | null;

  @AllowNull
  @Column(INTEGER)
  declare subtitleId: number | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(INTEGER)
  declare descriptionId: number | null;

  @AllowNull
  @Column(TEXT)
  declare documentation: string | null;

  @AllowNull
  @Column(TEXT)
  declare submissionMessage: string | null;

  @AllowNull
  @Column(INTEGER)
  declare submissionMessageId: number | null;

  @AllowNull
  @Column(TEXT)
  declare duration: string | null;

  @Column(BOOLEAN)
  declare published: boolean;

  @AllowNull
  @Column(UUID)
  declare stageId: string | null;

  @BelongsTo(() => Stage, { foreignKey: "stageId", targetKey: "uuid", constraints: false })
  declare stage: Stage | null;

  @Column(STRING)
  declare updatedBy: string | null;

  @AllowNull
  @Column(STRING)
  declare documentationLabel: string | null;

  /**
   * The funding programme, reporting framework, or entity that is using this form.
   *
   * Note: for this getter to work, the stage.fundingProgramme.name must be loaded on this
   * instance, along with framework.name
   */
  get attachedTo(): FormAttachment | null {
    if (this.stage?.fundingProgramme?.name != null) {
      return {
        name: this.stage.fundingProgramme.name,
        type: "fundingProgramme",
        adminId: this.stage.fundingProgramme.uuid
      };
    }

    if (this.type === "disturbance-report") {
      return { name: "Disturbance Report", type: "entity" };
    }
    if (this.type === "srp-report") {
      return { name: "SRP Report", type: "entity" };
    }
    if (this.model != null && this.framework != null) {
      return { name: this.framework.name, type: "framework", adminId: this.frameworkKey };
    }

    return null;
  }
}
