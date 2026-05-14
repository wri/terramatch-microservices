import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  HasMany,
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
  INTEGER,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FrameworkKey, OrganisationType } from "../constants";
import { Framework } from "./framework.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { I18nItem } from "./i18n-item.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { COMING_SOON, FundingProgrammeStatus } from "../constants/status";
import { Stage } from "./stage.entity";
import { removeMedia } from "../hooks/remove-media";

type FundingProgrammeMedia = "cover";

@Table({ tableName: "funding_programmes", underscored: true, paranoid: true, hooks: { afterDestroy: removeMedia } })
export class FundingProgramme extends Model<
  InferAttributes<FundingProgramme>,
  InferCreationAttributes<FundingProgramme>
> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FundingProgramme";

  static readonly MEDIA: Record<FundingProgrammeMedia, MediaConfiguration> = {
    cover: { dbCollection: "cover", multiple: false, validation: "cover-image" }
  };

  static readonly I18N_FIELDS = ["location"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(STRING)
  declare name: string;

  @AllowNull
  @Column(INTEGER)
  declare nameId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "name_id", constraints: false })
  declare nameI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  @Column({ type: STRING(30), defaultValue: COMING_SOON })
  declare status: CreationOptional<FundingProgrammeStatus>;

  @Column(TEXT)
  declare description: string;

  @AllowNull
  @Column(INTEGER)
  declare descriptionId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "description_id", constraints: false })
  declare descriptionI18nItem: I18nItem | null;

  @AllowNull
  @Column(TEXT)
  declare location: string | null;

  @AllowNull
  @Column(INTEGER)
  declare locationId: number | null;

  @AllowNull
  @Column(TEXT)
  declare readMoreUrl: string | null;

  @AllowNull
  @JsonColumn({ type: TEXT })
  declare organisationTypes: OrganisationType[] | null;

  @BelongsTo(() => I18nItem, { foreignKey: "location_id", constraints: false })
  declare locationI18nItem: I18nItem | null;

  @HasMany(() => Stage, { foreignKey: "fundingProgrammeId", sourceKey: "uuid", constraints: false })
  declare stages: Stage[] | null;
}
