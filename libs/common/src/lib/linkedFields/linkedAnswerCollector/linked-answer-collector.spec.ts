import { MediaService } from "../../media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { FormModels, LinkedAnswerCollector } from "./index";
import { Dictionary } from "lodash";
import { getLinkedFieldConfig } from "../index";
import { LinkedField, LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";

export const getRelation = (key: string) => getLinkedFieldConfig(key)?.field as LinkedRelation;
export const getField = (key: string) => getLinkedFieldConfig(key)?.field as LinkedField;

export class CollectorTestHarness {
  mediaService = createMock<MediaService>();
  collector = new LinkedAnswerCollector(this.mediaService);

  async getAnswers(models: FormModels) {
    const answers: Dictionary<unknown> = {};
    await this.collector.collect(answers, models);
    return answers;
  }

  async expectAnswers(models: FormModels, expected: Dictionary<unknown>) {
    expect(await this.getAnswers(models)).toStrictEqual(expected);
  }
}

// The usage of this class is covered in the form data service spec and the individual collector specs.
