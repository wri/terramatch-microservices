import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Op,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { TreeSpeciesResearch } from "./tree-species-research.entity";
import { Literal } from "sequelize/types/utils";
import { SiteReport } from "./site-report.entity";
import { chainScope } from "../util/chain-scope";
import { NurseryReport } from "./nursery-report.entity";
import { ProjectReport } from "./project-report.entity";
import { FormModel } from "../constants/entities";
import { laravelType } from "../types/util";

@Scopes(() => ({
  visible: { where: { hidden: false } },
  siteReports: (ids: number[] | Literal) => ({
    where: {
      speciesableType: SiteReport.LARAVEL_TYPE,
      speciesableId: { [Op.in]: ids }
    }
  }),
  nurseryReports: (ids: number[] | Literal) => ({
    where: {
      speciesableType: NurseryReport.LARAVEL_TYPE,
      speciesableId: { [Op.in]: ids }
    }
  }),
  projectReports: (ids: number[] | Literal) => ({
    where: {
      speciesableType: ProjectReport.LARAVEL_TYPE,
      speciesableId: { [Op.in]: ids }
    }
  }),
  collection: (collection: string) => ({ where: { collection } }),
  entity: (entity: FormModel) => ({
    where: {
      speciesableType: laravelType(entity),
      speciesableId: entity.id
    }
  })
}))
@Table({
  tableName: "v2_tree_species",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [
    { name: "tree_species_type_id_collection", fields: ["collection", "speciesable_id", "speciesable_type"] },
    { name: "v2_tree_species_morph_index", fields: ["speciesable_id", "speciesable_type"] }
  ]
})
export class TreeSpecies extends Model<InferAttributes<TreeSpecies>, InferCreationAttributes<TreeSpecies>> {
  static readonly POLYMORPHIC_TYPE = "speciesableType";
  static readonly POLYMORPHIC_ID = "speciesableId";

  static visible() {
    return chainScope(this, "visible") as typeof TreeSpecies;
  }

  static siteReports(ids: number[] | Literal) {
    return chainScope(this, "siteReports", ids) as typeof TreeSpecies;
  }

  static nurseryReports(ids: number[] | Literal) {
    return chainScope(this, "nurseryReports", ids) as typeof TreeSpecies;
  }

  static collection(collection: string) {
    return chainScope(this, "collection", collection) as typeof TreeSpecies;
  }

  static projectReports(ids: number[] | Literal) {
    return chainScope(this, "projectReports", ids) as typeof TreeSpecies;
  }

  static for(entity: FormModel) {
    return chainScope(this, "entity", entity) as typeof TreeSpecies;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @ForeignKey(() => TreeSpeciesResearch)
  @Column(STRING)
  taxonId: string | null;

  @AllowNull
  @Column(BIGINT)
  amount: number | null;

  @AllowNull
  @Index("v2_tree_species_collection_index")
  @Column(STRING)
  collection: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: CreationOptional<boolean>;

  @Column(STRING)
  speciesableType: string;

  @Column(BIGINT.UNSIGNED)
  speciesableId: number;
}
