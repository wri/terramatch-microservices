import { FormModel, FormModelType } from "@terramatch-microservices/database/constants/entities";
import {
  isField,
  isFile,
  isRelation,
  LinkedField,
  LinkedFieldResource,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { MediaService } from "../../media/media.service";
import { fieldCollector } from "./field.collector";
import { fileCollector } from "./file.collector";
import { demographicsCollector } from "./demographics.collector";
import { treeSpeciesCollector } from "./tree-species.collector";
import { disturbancesCollector } from "./disturbances.collector";
import { invasivesCollector } from "./invasives.collector";
import { seedingsCollector } from "./seedings.collector";
import { stratasCollector } from "./stratas.collector";
import { ownershipStakeCollector } from "./ownership-stake.collector";
import { leadershipsCollector } from "./leaderships.collector";
import { fundingTypesCollector } from "./funding-types.collector";
import { financialIndicatorsCollector } from "./financial-indicators.collector";
import { disturbanceReportEntriesCollector } from "./disturbance-report-entries.collector";
import { TMLogger } from "../../util/tm-logger";
import { FormQuestion } from "@terramatch-microservices/database/entities";
import { getLinkedFieldConfig } from "../index";

export type FormTypeMap<T> = Partial<Record<FormModelType, T>>;
export type FormModels = FormTypeMap<FormModel>;

export interface ResourceCollector<TField extends LinkedField | LinkedFile | LinkedRelation> {
  /**
   * Gather information about which fields / models this collector will need to pull data from
   */
  addField(field: TField, modelType: FormModelType, questionUuid: string): void;

  /**
   * Execute as few queries as possible to satisfy all current answer data for this form.
   */
  collect(answers: Dictionary<unknown>, models: FormModels): Promise<void>;
}

export interface FieldResourceCollector extends ResourceCollector<LinkedField> {
  /**
   * Syncs the answers from a form for this field.
   */
  syncField(model: FormModel, question: FormQuestion, field: LinkedField, answers: Dictionary<unknown>): Promise<void>;
}

export interface RelationResourceCollector extends ResourceCollector<LinkedRelation> {
  /**
   * Syncs the answers from a form for this relation type. May NOOP if this is not a relation collector.
   */
  syncRelation(
    model: FormModel,
    field: LinkedRelation,
    answer: object[] | null | undefined,
    hidden: boolean
  ): Promise<void>;
}

export class LinkedAnswerCollector {
  public fields = fieldCollector(new TMLogger("Fields Collector"));
  public files = fileCollector(new TMLogger("File Collector"), this.mediaService);

  private relationCollectors = {} as Partial<Record<LinkedFieldResource, RelationResourceCollector>>;

  constructor(private readonly mediaService: MediaService) {}

  get demographics() {
    return this.getCollector("demographics", () => demographicsCollector(new TMLogger("Demographics Collector")));
  }
  get treeSpecies() {
    return this.getCollector("treeSpecies", () => treeSpeciesCollector(new TMLogger("Tree Species Collector")));
  }
  get disturbances() {
    return this.getCollector("disturbances", () => disturbancesCollector(new TMLogger("Disturbances Collector")));
  }
  get invasives() {
    return this.getCollector("invasives", () => invasivesCollector(new TMLogger("Invasives Collector")));
  }
  get seedings() {
    return this.getCollector("seedings", () => seedingsCollector(new TMLogger("Seedings Collector")));
  }
  get stratas() {
    return this.getCollector("stratas", () => stratasCollector(new TMLogger("Stratas Collector")));
  }
  get ownershipStake() {
    return this.getCollector("ownershipStake", () =>
      ownershipStakeCollector(new TMLogger("Ownership Stake Collector"))
    );
  }
  get leaderships() {
    return this.getCollector("leaderships", () => leadershipsCollector(new TMLogger("Leaderships Collector")));
  }
  get fundingTypes() {
    return this.getCollector("fundingTypes", () => fundingTypesCollector(new TMLogger("Funding Types Collector")));
  }
  get financialIndicators() {
    return this.getCollector("financialIndicators", () =>
      financialIndicatorsCollector(new TMLogger("Financial Indicators Collector"))
    );
  }
  get disturbanceReportEntries() {
    return this.getCollector("disturbanceReportEntries", () =>
      disturbanceReportEntriesCollector(new TMLogger("Disturbance Report Entries Collector"))
    );
  }

  async getAnswers(nonLinkedAnswers: Dictionary<unknown>, questions: FormQuestion[], models: FormModels) {
    const answers: Dictionary<unknown> = {};
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        answers[question.uuid] = nonLinkedAnswers?.[question.uuid];
      } else {
        if (isField(config.field)) this.fields.addField(config.field, config.model, question.uuid);
        else if (isFile(config.field)) this.files.addField(config.field, config.model, question.uuid);
        else if (isRelation(config.field)) {
          this[config.field.resource].addField(config.field, config.model, question.uuid);
        }
      }
    }

    await this.collect(answers, models);
    return answers;
  }

  async collect(answers: Dictionary<unknown>, models: FormModels) {
    await Promise.all(
      [this.fields, this.files, ...Object.values(this.relationCollectors)].map(collector =>
        collector.collect(answers, models)
      )
    );
  }

  protected getCollector(resource: LinkedFieldResource, factory: () => RelationResourceCollector) {
    return this.relationCollectors[resource] ?? (this.relationCollectors[resource] = factory());
  }
}
