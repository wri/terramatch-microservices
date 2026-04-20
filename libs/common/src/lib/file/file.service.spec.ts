/* eslint-disable @typescript-eslint/no-explicit-any */
import { FileService } from "./file.service";
import { createMock, PartialFuncReturn } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { faker } from "@faker-js/faker";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "node:stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() }))
  };
});

jest.mock("@aws-sdk/lib-storage");
jest.mock("@aws-sdk/s3-request-presigner");

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

  const expectCommand = async <T>(
    command:
      | typeof PutObjectCommand
      | typeof CopyObjectCommand
      | typeof DeleteObjectCommand
      | typeof HeadObjectCommand
      | typeof GetObjectCommand,
    expected: object,
    callService: () => Promise<T>,
    mockError?: Error
  ) => {
    const sendSpy = s3Spy();
    if (mockError != null) sendSpy.mockRejectedValue(mockError);
    const result = await callService();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(expect.any(command));
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining(expected) }));
    return result;
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

  describe("uploadStream", () => {
    it("should start an upload to s3", () => {
      jest.spyOn(Upload.prototype, "done").mockRejectedValue("error");
      service.uploadStream("test-bucket", "test-key", "text/plain");
      expect(Upload).toHaveBeenCalledTimes(1);
      expect(Upload).toHaveBeenCalledWith({
        client: expect.anything(),
        params: {
          Bucket: "test-bucket",
          Key: "test-key",
          Body: expect.any(PassThrough),
          ContentType: "text/plain"
        }
      });
      expect(jest.mocked(Upload).mock.instances[0].done).toHaveBeenCalledTimes(1);
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

  describe("remoteFileExists", () => {
    it("should return true if there is no error", async () => {
      const result = await expectCommand(
        HeadObjectCommand,
        {
          Bucket: "test-bucket",
          Key: "test-key"
        },
        () => service.remoteFileExists("test-bucket", "test-key")
      );
      expect(result).toBe(true);
    });

    it("should return false if there is an error", async () => {
      const result = await expectCommand(
        HeadObjectCommand,
        {
          Bucket: "test-bucket",
          Key: "test-key"
        },
        () => service.remoteFileExists("test-bucket", "test-key"),
        new Error()
      );
      expect(result).toBe(false);
    });
  });

  describe("generatePresignedUrl", () => {
    it("should return a presigned url", async () => {
      const spy = jest.mocked(getSignedUrl);
      await service.generatePresignedUrl("test-bucket", "test-key");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBeInstanceOf(GetObjectCommand);
      expect(spy.mock.calls[0][1]).toMatchObject({ input: { Bucket: "test-bucket", Key: "test-key" } });
      expect(spy.mock.calls[0][2]).toMatchObject({ expiresIn: 3600 });
    });
  });

  describe("deleteRemoteFile", () => {
    it("should send the delete command to s3", async () => {
      await expectCommand(DeleteObjectCommand, { Bucket: "test-bucket", Key: "test-key" }, () =>
        service.deleteRemoteFile("test-bucket", "test-key")
      );
    });
  });
});
