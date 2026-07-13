import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";
import { I18nItem } from "./i18n-item.entity";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";

export const ABOUT_SECTION_TYPES = [
  "project",
  "site",
  "nursery",
  "project-report",
  "site-report",
  "nursery-report"
] as const;
export type AboutSectionType = (typeof ABOUT_SECTION_TYPES)[number];

@Table({ tableName: "about_sections", underscored: true, paranoid: true })
export class AboutSection extends Model<InferAttributes<AboutSection>, InferCreationAttributes<AboutSection>> {
  // Still named laravel type for legacy reasons, but the name doesn't need to follow that convention; just needs to be unique
  static readonly LARAVEL_TYPE = "AboutSection";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Column(STRING)
  declare type: AboutSectionType;

  @AllowNull
  @JsonColumn()
  declare frameworks: FrameworkKey[] | null;

  @Column(BIGINT.UNSIGNED)
  declare headerId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "header_id", constraints: false })
  declare header: I18nItem | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare titleId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "title_id", constraints: false })
  declare title: I18nItem | null;

  @Column(BIGINT.UNSIGNED)
  declare descriptionId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "description_id", constraints: false })
  declare description: I18nItem | null;

  @Column(BIGINT.UNSIGNED)
  declare contactSupportMessageId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "contact_support_message_id", constraints: false })
  declare contactSupportMessage: I18nItem | null;

  @Column(BIGINT.UNSIGNED)
  declare contactSupportSubjectId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "contact_support_subject_id", constraints: false })
  declare contactSupportSubject: I18nItem | null;
}
