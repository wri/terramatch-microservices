import { Response } from "express";
import { Test } from "@nestjs/testing";
import {
  CsvExportService,
  FormQuestionExportMapping,
  getAttributes,
  getFormQuestionsForExport
} from "./csv-export.service";
import { FileService } from "../file/file.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "../media/media.service";
import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { createResponse } from "node-mocks-http";
import { Model } from "sequelize";
import {
  EntityFormFactory,
  FormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  MediaFactory,
  SiteFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { Media } from "@terramatch-microservices/database/entities";
import { DateTime } from "luxon";
import { Archiver } from "archiver";
import { PassThrough } from "node:stream";

const mockResponse = () => {
  const response = createResponse({ eventEmitter: EventEmitter });
  const streamEnd = new Promise<string>(resolve => {
    response.on("end", () => {
      resolve(response._getBuffer().toString());
    });
  });

  return { response, streamEnd };
};

describe("CsvExportService", () => {
  let service: CsvExportService;
  let configService: DeepMocked<ConfigService>;
  let fileService: DeepMocked<FileService>;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: FileService, useValue: (fileService = createMock<FileService>()) },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        {
          provide: ConfigService,
          useValue: (configService = createMock<ConfigService>({
            get: (key: string) => {
              if (key === "AWS_BUCKET") return "test-bucket";
              return "";
            }
          }))
        },
        CsvExportService
      ]
    }).compile();

    service = module.get(CsvExportService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("get bucket", () => {
    it("returns the configured bucket", () => {
      expect(service.bucket).toEqual("test-bucket");
    });

    it("throws if no bucket is configured", () => {
      configService.get.mockReturnValue(undefined);
      expect(() => service.bucket).toThrow(InternalServerErrorException);
    });
  });

  describe("exportExists", () => {
    it("calls the file service", async () => {
      await service.exportExists("test.csv");
      expect(fileService.remoteFileExists).toHaveBeenCalledWith("test-bucket", "exports/test.csv");
    });
  });

  describe("generateExportDto", () => {
    it("calls the file service for a presigned url", async () => {
      await service.generateExportDto("test.csv");
      expect(fileService.generatePresignedUrl).toHaveBeenCalledWith("test-bucket", "exports/test.csv");
    });
  });

  describe("getS3StreamWriter", () => {
    it("gets an upload stream from the file service", () => {
      service.getS3StreamWriter("test.csv", {});
      expect(fileService.uploadStream).toHaveBeenCalledWith("test-bucket", "exports/test.csv", "text/csv");
    });
  });

  describe("getArchiveWriter", () => {
    it("gets a stream for an archive file", () => {
      const append = jest.fn();
      service.getArchiveWriter("test.csv", { append } as unknown as Archiver, { name: "Name" });
      expect(append).toHaveBeenCalledWith(expect.any(PassThrough), { name: "test.csv" });
    });
  });

  describe("getResponseStreamWriter", () => {
    it("returns a writable stream for the response", async () => {
      const { response, streamEnd } = mockResponse();
      const stream = service.getResponseStreamWriter("test.csv", response, { name: "Name" });

      stream.addRow({ name: "Foo" } as unknown as Model);
      stream.close();

      const result = await streamEnd;
      expect(result).toBe("Name\nFoo\n");
      expect(response.get("Content-Type")).toBe("text/csv");
      expect(response.get("Content-Disposition")).toBe('attachment; filename="test.csv"');
      expect(response.get("Access-Control-Expose-Headers")).toBe("Content-Disposition");
    });

    it("serializes values", async () => {
      const { response, streamEnd } = mockResponse();
      const columns = {
        name: "Name",
        createdAt: "Created At",
        cover: "Cover",
        states: "States",
        complexData: "Complex Data"
      };

      const sites = await SiteFactory.createMany(2);
      const stream = service.getResponseStreamWriter("test.csv", response, columns);
      mediaService.getUrl.mockReturnValue("url-for-media");

      stream.addRow(sites[0], { cover: new Media(), states: ["OR", "CA"], complexData: { foo: "bar" } });
      stream.addRow(sites[1], { cover: new Media(), states: ["VT", "NY"], complexData: { foo: "baz" } });
      stream.close();

      const result = await streamEnd;
      expect(result).toBe(`Name,Created At,Cover,States,Complex Data
${sites[0].name},${DateTime.fromJSDate(sites[0].createdAt).toISODate()},url-for-media,OR|CA,"{""foo"":""bar""}"
${sites[1].name},${DateTime.fromJSDate(sites[1].createdAt).toISODate()},url-for-media,VT|NY,"{""foo"":""baz""}"
`);
    });
  });

  describe("getFormQuestionsForExport", () => {
    it("returns the linked field form questions for the given model", async () => {
      const form = await FormFactory.create();
      // Mess with section / question order to test ordering of the mappings in the end.
      const sections = [
        await FormSectionFactory.form(form).create({ order: 2 }),
        await FormSectionFactory.form(form).create({ order: 1 })
      ];
      const parentQuestion = await FormQuestionFactory.section(sections[1]).create({
        inputType: "conditional",
        order: 3
      });
      const questions = [
        await FormQuestionFactory.section(sections[0]).create({ linkedFieldKey: "pro-land-use-types" }),
        await FormQuestionFactory.section(sections[1]).create({
          linkedFieldKey: "pro-full-clt-time-jobs-count",
          order: 1,
          parentId: parentQuestion.uuid
        }),
        await FormQuestionFactory.section(sections[1]).create({ linkedFieldKey: "pro-col-media", order: 4 }),
        await FormQuestionFactory.section(sections[1]).create({ linkedFieldKey: "pro-hectares-goal", order: 2 })
      ];

      const mappings = await getFormQuestionsForExport(form);
      expect(mappings).toEqual([
        { heading: "hectaresGoal", questionUuid: questions[3].uuid, attribute: undefined, config: expect.anything() },
        {
          heading: "fullTimeCltJobsAggregate",
          questionUuid: questions[1].uuid,
          attribute: undefined,
          config: expect.anything()
        },
        { heading: "media", questionUuid: questions[2].uuid, attribute: undefined, config: expect.anything() },
        {
          heading: "landUseTypes",
          questionUuid: questions[0].uuid,
          attribute: { attribute: "landUseTypes", model: "projects" },
          config: expect.anything()
        }
      ]);
    });
  });

  describe("getAttributes", () => {
    it("returns the attributes required by the mappings", () => {
      const mappings = [
        { attribute: { model: "sites", attribute: "name" } },
        { attribute: { model: "projects", attribute: "uuid" } },
        {},
        { attribute: { model: "sites", attribute: "country" } }
      ] as FormQuestionExportMapping[];

      expect(getAttributes(mappings, "sites")).toEqual(["name", "country"]);
      expect(getAttributes(mappings, "projects")).toEqual(["uuid"]);
    });
  });

  describe("collectFormCells", () => {
    it("collects form answers for export", async () => {
      const site = await SiteFactory.create({ history: faker.lorem.paragraphs(3) });
      const form = await EntityFormFactory.site(site).create();
      const section = await FormSectionFactory.form(form).create();
      await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "site-history"
      });
      await FormQuestionFactory.section(section).create({
        inputType: "file",
        linkedFieldKey: "site-col-media"
      });
      await MediaFactory.site(site).createMany(2, { collectionName: "media" });
      mediaService.getUrl.mockReturnValue("url-for-media");

      const mappings = await getFormQuestionsForExport(form);
      const result = await service.collectFormCells(mappings, { sites: site }, "terrafund");
      expect(result).toEqual({
        history: site.history,
        media: ["url-for-media", "url-for-media"]
      });
    });
  });

  describe("writeCsv", () => {
    it("closes the stream when there's an error", async () => {
      const writeRows = async () => {
        throw new Error("failed stream");
      };
      const close = jest.fn();
      jest.spyOn(service, "getArchiveWriter").mockReturnValue({ addRow: jest.fn(), close });
      await expect(service.writeCsv("test.csv", {} as Response, {}, writeRows)).rejects.toThrowError("failed stream");
      expect(close).toHaveBeenCalled();
    });

    it("closes the stream on success", async () => {
      const writeRows = () => Promise.resolve();
      const close = jest.fn();
      jest.spyOn(service, "getArchiveWriter").mockReturnValue({ addRow: jest.fn(), close });
      await service.writeCsv("test.csv", {} as Response, {}, writeRows);
      expect(close).toHaveBeenCalled();
    });
  });
});
