import {
  AllowNull,
  AutoIncrement,
  Column,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Link } from "./link.entity";

export const ABOUT_SECTION_TYPES = [
  "project",
  "site",
  "nursery",
  "project-report",
  "site-report",
  "nursery-report"
] as const;
export type AboutSectionType = (typeof ABOUT_SECTION_TYPES)[number];

@Table({
  tableName: "about_sections",
  underscored: true,
  paranoid: true,
  hooks: {
    async afterDestroy(section: AboutSection) {
      await Link.for(section).destroy();
    }
  }
})
export class AboutSection extends Model<InferAttributes<AboutSection>, InferCreationAttributes<AboutSection>> {
  // Still named laravel type for legacy reasons, but the name doesn't need to follow that convention; just needs to be unique
  static readonly LARAVEL_TYPE = "AboutSection";

  static readonly I18N_FIELDS = [
    "header",
    "title",
    "description",
    "contactSupportMessage",
    "contactSupportSubject"
  ] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(STRING)
  declare type: AboutSectionType;

  @AllowNull
  @JsonColumn()
  declare frameworks: FrameworkKey[] | null;

  @Column(TEXT)
  declare header: string;

  @AllowNull
  @Column(TEXT)
  declare title: string | null;

  @Column(TEXT)
  declare description: string | null;

  @Column(TEXT)
  declare contactSupportMessage: string;

  @Column(TEXT)
  declare contactSupportSubject: string;

  @HasMany(() => Link, {
    foreignKey: "linkableId",
    constraints: false,
    scope: { linkableType: AboutSection.LARAVEL_TYPE }
  })
  declare links: Link[] | null;
}
