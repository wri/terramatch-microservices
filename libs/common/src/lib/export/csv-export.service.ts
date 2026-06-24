import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { stringify } from "csv-stringify";
import { FileService } from "../file/file.service";
import { ConfigService } from "@nestjs/config";
import { FileDownloadDto } from "../dto/file-download.dto";
import { Dictionary, groupBy, isString } from "lodash";
import { Model } from "sequelize";
import { DateTime } from "luxon";
import { Response } from "express";
import {
  getExportHeading,
  getLinkedFieldConfig,
  getModelAttribute,
  LinkedFieldSpecification,
  ModelAttribute
} from "../linkedFields";
import { Form, FormQuestion, FormSection, Media } from "@terramatch-microservices/database/entities";
import { FormModels, LinkedAnswerCollector } from "../linkedFields/linkedAnswerCollector";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { MediaService } from "../media/media.service";
import { isField, isFile } from "@terramatch-microservices/database/constants/linked-fields";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { TMLogger } from "../util/tm-logger";
import { Archiver } from "archiver";
import { PassThrough } from "node:stream";

export type AddRow = (...sources: (Model | Dictionary<unknown>)[]) => void;
export type StreamWriter = {
  addRow: AddRow;
  close: () => void;
};

export type RowWriter = (addRow: StreamWriter["addRow"]) => Promise<void>;

export type FormQuestionExportMapping = {
  questionUuid: string;
  heading: string;
  config: LinkedFieldSpecification;
  attribute?: ModelAttribute;
};

const isArchive = (target: Response | Archiver): target is Archiver => "finalize" in target;

export const getFormQuestionsForExport = async (form: Form) => {
  const sections = await FormSection.findAll({ where: { formId: form.uuid }, order: [["order", "ASC"]] });
  const questions = await FormQuestion.forForm(form.uuid).findAll({ order: [["order", "ASC"]] });
  const sectionQuestions = groupBy(
    questions.filter(({ parentId }) => parentId == null),
    "formSectionId"
  );
  const childQuestions = groupBy(
    questions.filter(({ parentId }) => parentId != null),
    "parentId"
  );

  const mappings: FormQuestionExportMapping[] = [];

  for (const section of sections) {
    for (const question of sectionQuestions[`${section.id}`] ?? []) {
      addQuestionToMapping(mappings, question);

      for (const child of childQuestions[question.uuid] ?? []) {
        addQuestionToMapping(mappings, child);
      }
    }
  }

  return mappings;
};

export const getAttributes = (mappings: FormQuestionExportMapping[], model: FormModelType) => {
  return mappings
    .filter(({ attribute }) => attribute?.model === model)
    .map(({ attribute }) => attribute?.attribute)
    .filter(isNotNull);
};

const addQuestionToMapping = (mappings: FormQuestionExportMapping[], question: FormQuestion) => {
  if (question.linkedFieldKey == null || question.inputType === "tableInput" || question.inputType === "mapInput")
    return;

  const config = getLinkedFieldConfig(question.linkedFieldKey);
  if (config == null) return;

  mappings.push({
    questionUuid: question.uuid,
    heading: getExportHeading(config),
    attribute: getModelAttribute(config),
    config
  });
};

export const getMappingsColumns = (mappings: FormQuestionExportMapping[]): Dictionary<string> =>
  mappings.reduce((acc, { heading }) => ({ ...acc, [heading]: heading }), {});

@Injectable()
export class CsvExportService {
  private readonly logger = new TMLogger(CsvExportService.name);

  constructor(
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService
  ) {}

  get bucket() {
    const bucket = this.configService.get<string>("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET is not set");
    return bucket;
  }

  async exportExists(fileName: string) {
    return await this.fileService.remoteFileExists(this.bucket, `exports/${fileName}`);
  }

  async generateExportDto(fileName: string) {
    return new FileDownloadDto(await this.fileService.generatePresignedUrl(this.bucket, `exports/${fileName}`));
  }

  /**
   * A utility to make it easy for services to write to an arbitrary destination. If target is undefined,
   * the file will be sent to the environment's default bucket.
   */
  async writeCsv(
    fileName: string,
    target: Archiver | Response | string | undefined | null,
    columns: Dictionary<string>,
    writeRows: RowWriter
  ) {
    if (target == null || isString(target)) {
      if (target == null) fileName = `exports/${fileName}`;
      await this.fileService.uploadStream(target ?? this.bucket, fileName, "text/csv", async stream => {
        await this.writeToStream(stream, columns, writeRows);
      });
    } else if (isArchive(target)) {
      const passThrough = new PassThrough();
      target.append(passThrough, { name: fileName });
      await this.writeToStream(passThrough, columns, writeRows);
    } else {
      target.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Access-Control-Expose-Headers": "Content-Disposition"
      });
      await this.writeToStream(target, columns, writeRows);
    }
  }

  async writeToStream(destination: NodeJS.WritableStream, columns: Dictionary<string>, writeRows: RowWriter) {
    const stringifier = stringify({ header: true, columns });
    stringifier.pipe(destination);

    const keys = Object.keys(columns);
    const addRow = (...sources: (Model | Dictionary<unknown>)[]) => {
      // Use sources in reverse order so sources later in the list override values from earlier ones.
      const reverseSources = sources.toReversed();
      const getValue = (key: string) => {
        for (const source of reverseSources) {
          if (source instanceof Model) {
            if (source.get(key) != null) return source.get(key);
          } else if (source[key] != null) return source[key];
        }

        return undefined;
      };
      const row = keys.reduce(
        (acc, key) => ({
          ...acc,
          [key]: this.serializeCell(getValue(key))
        }),
        {}
      );
      stringifier.write(row);
    };

    try {
      await writeRows(addRow);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error exporting CSV file: [${error.message}]`, error.stack);
      } else {
        this.logger.error(`Error exporting CSV file: [${error}]`);
      }
      throw error;
    } finally {
      stringifier.end();
    }
  }

  async collectFormCells(mappings: FormQuestionExportMapping[], models: FormModels, frameworkKey?: FrameworkKey) {
    const collector = new LinkedAnswerCollector(this.mediaService);
    for (const mapping of mappings) {
      if (mapping.config == null) continue;

      const { model, field } = mapping.config;
      if (isField(field)) collector.fields.addField(field, model, mapping.questionUuid);
      else if (isFile(field)) collector.files.addField(field, model, mapping.questionUuid);
      else collector[field.resource].addField(field, model, mapping.questionUuid);
    }

    const answers: Dictionary<unknown> = {};
    await collector.collect(answers, models, { forExport: true, frameworkKey });

    // Some collectors need the original question UUID to correctly map their readable export data,
    // so we have to pass the question UUID into the collector and then re-map to our headings after
    // data collection.
    return Object.entries(answers).reduce((acc, [questionUuid, value]) => {
      const { heading } = mappings.find(mapping => questionUuid === mapping.questionUuid) ?? {};
      return heading == null ? acc : { ...acc, [heading]: value };
    }, {});
  }

  private serializeCell(value: unknown): string | number {
    if (value == null) return "";
    if (value instanceof Date) return DateTime.fromJSDate(value).toISODate() ?? "";
    if (value instanceof Media) return this.mediaService.getUrl(value) ?? "";
    if (Array.isArray(value)) {
      return value.map(v => (v == null ? "" : this.serializeCell(v))).join("|");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value as string | number;
  }
}
