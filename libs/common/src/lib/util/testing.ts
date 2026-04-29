/* istanbul ignore file */
import { DocumentBuilder, JsonApiDocument, ResourceBuilder } from "./json-api-builder";
import { RequestContext } from "nestjs-request-context";
import { getLinkedFieldConfig } from "../linkedFields";
import { LinkedField, LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "../media/media.service";
import { CollectOptions, FormModels, LinkedAnswerCollector } from "../linkedFields/linkedAnswerCollector";
import { Dictionary } from "lodash";
import { LocalizationService, Translations } from "../localization/localization.service";
import { Model } from "sequelize-typescript";
import { Attributes } from "sequelize";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { PolicyBuilder } from "../policies/policy.service";

/**
 * A utility for unit tests that can take any likely response from a standard v3 controller and
 * produce a JsonApiDocument from it.
 */
export const serialize = (data: JsonApiDocument | DocumentBuilder | ResourceBuilder) => {
  if (data instanceof DocumentBuilder) return data.serialize();
  if (data instanceof ResourceBuilder) return data.document.serialize();
  return data;
};

/**
 * Mock the request context userId, which is relied on in many controllers and services
 */
export function mockRequestContext({
  userId,
  permissions = [],
  locale
}: { userId?: number; permissions?: string[] | null; locale?: ValidLocale } = {}) {
  jest.spyOn(RequestContext, "currentContext", "get").mockReturnValue({
    req: {
      authenticatedUserId: userId,
      permissions: permissions,
      userLocale: locale,
      policyBuilder: userId == null || permissions == null ? undefined : new PolicyBuilder(userId, permissions)
    },
    res: {}
  });
}

export const getRelation = (key: string) => getLinkedFieldConfig(key)?.field as LinkedRelation;
export const getField = (key: string) => getLinkedFieldConfig(key)?.field as LinkedField;

export class CollectorTestHarness {
  mediaService = createMock<MediaService>();
  collector = new LinkedAnswerCollector(this.mediaService);

  async getAnswers(models: FormModels, opts: CollectOptions = {}) {
    const answers: Dictionary<unknown> = {};
    await this.collector.collect(answers, models, opts);
    return answers;
  }

  async expectAnswers(models: FormModels, expected: Dictionary<unknown>, opts: CollectOptions = {}) {
    expect(await this.getAnswers(models, opts)).toStrictEqual(expected);
  }
}

export const mockTranslateFieldsWithOriginal = (service: DeepMocked<LocalizationService>) => {
  // Copied from the original service.
  service.translateFields.mockImplementation(
    <M extends Model, K extends (keyof Attributes<M>)[]>(translations: Translations, model: M, fields: K) =>
      fields.reduce(
        (translated, field) => ({
          ...translated,
          [field]: translations[model[`${String(field)}Id` as Attributes<M>[number]] ?? -1] ?? model[field]
        }),
        {} as Record<(typeof fields)[number], string>
      )
  );
};
