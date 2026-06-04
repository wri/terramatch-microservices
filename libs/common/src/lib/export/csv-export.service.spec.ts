import { Test, TestingModule } from "@nestjs/testing";
import {
  CsvExportService,
  FormQuestionExportMapping,
  getAttributes,
  getFormQuestionsForExport,
  RowWriter
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
import { Archiver } from "archiver";
import { PassThrough } from "node:stream";
import { DateTime } from "luxon";
import { Media } from "@terramatch-microservices/database/entities";

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
  let module: TestingModule;

  const configService = (): DeepMocked<ConfigService> => module.get(ConfigService);
  const fileService = (): DeepMocked<FileService> => module.get(FileService);
  const mediaService = (): DeepMocked<MediaService> => module.get(MediaService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        { provide: FileService, useValue: createMock<FileService>() },
        { provide: MediaService, useValue: createMock<MediaService>() },
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: (key: string) => {
              if (key === "AWS_BUCKET") return "test-bucket";
              return "";
            }
          })
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
      configService().get.mockReturnValue(undefined);
      expect(() => service.bucket).toThrow(InternalServerErrorException);
    });
  });

  describe("exportExists", () => {
    it("calls the file service", async () => {
      await service.exportExists("test.csv");
      expect(fileService().remoteFileExists).toHaveBeenCalledWith("test-bucket", "exports/test.csv");
    });
  });

  describe("generateExportDto", () => {
    it("calls the file service for a presigned url", async () => {
      await service.generateExportDto("test.csv");
      expect(fileService().generatePresignedUrl).toHaveBeenCalledWith("test-bucket", "exports/test.csv");
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
      mediaService().getUrl.mockReturnValue("url-for-media");

      const mappings = await getFormQuestionsForExport(form);
      const result = await service.collectFormCells(mappings, { sites: site }, "terrafund");
      expect(result).toEqual({
        history: site.history,
        media: ["url-for-media", "url-for-media"]
      });
    });
  });

  describe("writeCsv", () => {
    it("writes to S3 when given no target", async () => {
      jest.spyOn(service, "writeToStream").mockResolvedValue(undefined);
      await service.writeCsv("test.csv", null, {}, async () => {
        /* empty */
      });
      expect(fileService().uploadStream).toHaveBeenCalledWith(
        "test-bucket",
        "exports/test.csv",
        "text/csv",
        expect.any(Function)
      );
    });

    it("writes to S3 when given a string target", async () => {
      jest.spyOn(service, "writeToStream").mockResolvedValue(undefined);
      await service.writeCsv("test.csv", "other-test-bucket", {}, async () => {
        /* empty */
      });
      expect(fileService().uploadStream).toHaveBeenCalledWith(
        "other-test-bucket",
        "test.csv",
        "text/csv",
        expect.any(Function)
      );
    });

    it("writes to the server response when given a Response target", async () => {
      const { response, streamEnd } = mockResponse();
      const writeRows: RowWriter = async addRow => {
        addRow({ name: "Foo" } as unknown as Model);
      };

      await service.writeCsv("test.csv", response, { name: "Name" }, writeRows);

      const result = await streamEnd;
      expect(result).toBe("Name\nFoo\n");
      expect(response.get("Content-Type")).toBe("text/csv");
      expect(response.get("Content-Disposition")).toBe('attachment; filename="test.csv"');
      expect(response.get("Access-Control-Expose-Headers")).toBe("Content-Disposition");
    });

    it("writes to an archive when given an Archiver target", async () => {
      jest.spyOn(service, "writeToStream").mockResolvedValue(undefined);
      const writeRows = async () => {
        /* empty */
      };
      const append = jest.fn();
      const finalize = jest.fn();
      const columns = { name: "Name" };
      await service.writeCsv("test.csv", { append, finalize } as unknown as Archiver, columns, writeRows);

      expect(append).toHaveBeenCalledWith(expect.any(PassThrough), { name: "test.csv" });
      expect(service.writeToStream).toHaveBeenCalledWith(expect.any(PassThrough), columns, writeRows);
    });
  });

  describe("writeToStream", () => {
    it("rethrows when there's an error", async () => {
      const writeRows = async () => {
        throw new Error("failed stream");
      };
      await expect(service.writeToStream(new PassThrough(), {}, writeRows)).rejects.toThrow("failed stream");
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
      mediaService().getUrl.mockReturnValue("url-for-media");

      const writeRows: RowWriter = async addRow => {
        addRow(sites[0], { cover: new Media(), states: ["OR", "CA"], complexData: { foo: "bar" } });
        addRow(sites[1], { cover: new Media(), states: ["VT", "NY"], complexData: { foo: "baz" } });
      };

      await service.writeToStream(response, columns, writeRows);

      const result = await streamEnd;
      expect(result).toBe(`Name,Created At,Cover,States,Complex Data
${sites[0].name},${DateTime.fromJSDate(sites[0].createdAt).toISODate()},url-for-media,OR|CA,"{""foo"":""bar""}"
${sites[1].name},${DateTime.fromJSDate(sites[1].createdAt).toISODate()},url-for-media,VT|NY,"{""foo"":""baz""}"
`);
    });
  });
});
