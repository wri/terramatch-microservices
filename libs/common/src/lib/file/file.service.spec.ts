/* eslint-disable @typescript-eslint/no-explicit-any */
import { FileService } from "./file.service";
import { createMock, PartialFuncReturn } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { faker } from "@faker-js/faker";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from "@aws-sdk/client-s3";

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() }))
  };
});

const createTestFile = (mimetype = "text/plain", ext = "txt", size = 123) =>
  ({
    originalname: faker.system.commonFileName(ext),
    mimetype,
    size,
    buffer: Buffer.from("test text file")
  } as Express.Multer.File);

describe("FileService", () => {
  let service: FileService;

  const s3Spy = () => jest.spyOn((service as any).s3, "send");

  const expectCommand = async (
    command: typeof PutObjectCommand | typeof CopyObjectCommand | typeof DeleteObjectCommand,
    expected: object,
    callService: () => Promise<void>
  ) => {
    const sendSpy = s3Spy();
    await callService();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(expect.any(command));
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining(expected) }));
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => {
              if (key === "AWS_ENDPOINT") return "https://aws.endpoint";
              if (key === "AWS_BUCKET") return "test-bucket";
              return "";
            }
          })
        }
      ]
    }).compile();

    service = module.get(FileService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should send the file to s3", async () => {
      const file = createTestFile();
      await expectCommand(
        PutObjectCommand,
        {
          Bucket: "test-bucket",
          Key: file.originalname,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: "public-read"
        },
        () => service.uploadFile(file.buffer, "test-bucket", file.originalname, file.mimetype)
      );
    });
  });

  describe("copyRemoteFile", () => {
    it("should send the copy command to s3", async () => {
      await expectCommand(
        CopyObjectCommand,
        {
          Bucket: "test-bucket",
          CopySource: "test-bucket/test-key",
          Key: "test-key-copy"
        },
        () => service.copyRemoteFile("test-bucket", "test-key", "test-key-copy")
      );
    });
  });

  describe("deleteRemoteFile", () => {
    it("should send the delete command to s3", async () => {
      await expectCommand(DeleteObjectCommand, { Bucket: "test-bucket", Key: "test-key" }, () =>
        service.deleteRemoteFile("test-bucket", "test-key")
      );
    });
  });

  describe("deleteObjectsInPrefixOlderThan", () => {
    it("should list and delete objects older than cutoff", async () => {
      const sendSpy = s3Spy();
      const old = new Date("2020-01-01T00:00:00.000Z");
      const cutoff = new Date("2024-01-01T00:00:00.000Z");
      sendSpy
        .mockResolvedValueOnce({
          Contents: [{ Key: "temp/old.csv", LastModified: old }],
          IsTruncated: false
        })
        .mockResolvedValueOnce({ Errors: [] });

      const n = await service.deleteObjectsInPrefixOlderThan("test-bucket", "temp/", cutoff);

      expect(n).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenNthCalledWith(1, expect.any(ListObjectsV2Command));
      expect(sendSpy).toHaveBeenNthCalledWith(2, expect.any(DeleteObjectsCommand));
    });

    it("should not delete when LastModified is after cutoff", async () => {
      const sendSpy = s3Spy();
      const recent = new Date("2030-01-01T00:00:00.000Z");
      const cutoff = new Date("2024-01-01T00:00:00.000Z");
      sendSpy.mockResolvedValueOnce({
        Contents: [{ Key: "temp/recent.csv", LastModified: recent }],
        IsTruncated: false
      });

      const n = await service.deleteObjectsInPrefixOlderThan("test-bucket", "temp/", cutoff);

      expect(n).toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });
});
