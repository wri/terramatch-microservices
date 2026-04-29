import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { stringify } from "csv-stringify";
import { FileService } from "../file/file.service";
import { ConfigService } from "@nestjs/config";
import { FileDownloadDto } from "../dto/file-download.dto";
import { Dictionary, groupBy, pick } from "lodash";
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

export type StreamWriter = {
  addRow: (model: Model, additional?: Dictionary<unknown>) => void;
  close: () => void;
};

export type FormQuestionExportMapping = {
  questionUuid: string;
  heading: string;
  config: LinkedFieldSpecification;
  attribute?: ModelAttribute;
};

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

  getS3StreamWriter(fileName: string, columns: Dictionary<string>): StreamWriter {
    return this.createStreamWriter(
      this.fileService.uploadStream(this.bucket, `exports/${fileName}`, "text/csv"),
      columns
    );
  }

  getResponseStreamWriter(fileName: string, response: Response, columns: Dictionary<string>): StreamWriter {
    response.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Access-Control-Expose-Headers": "Content-Disposition"
    });
    return this.createStreamWriter(response, columns);
  }

  async writeCsv(
    fileName: string,
    response: Response | undefined,
    columns: Dictionary<string>,
    writeRows: (addRow: StreamWriter["addRow"]) => Promise<void>
  ) {
    const { addRow, close } =
      response == null
        ? this.getS3StreamWriter(fileName, columns)
        : this.getResponseStreamWriter(fileName, response, columns);
    try {
      await writeRows(addRow);
    } catch (error) {
      this.logger.error(`Error exporting CSV file: [${fileName}, ${error.message}]`, error.stack);
      throw error;
    } finally {
      close();
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

  private createStreamWriter(destination: NodeJS.WritableStream, columns: Dictionary<string>): StreamWriter {
    const stringifier = stringify({ header: true, columns });
    stringifier.pipe(destination);

    const keys = Object.keys(columns);
    return {
      addRow: (model: Model, additional?: Dictionary<unknown>) => {
        const row = Object.entries({ ...pick(model, keys), ...additional }).reduce(
          (acc, [key, value]) => ({ ...acc, [key]: this.serializeCell(value) }),
          {}
        );
        stringifier.write(row);
      },
      close: () => stringifier.end()
    };
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
