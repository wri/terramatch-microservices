import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TMLogger } from "../util/tm-logger";
import { ConfigService } from "@nestjs/config";
import fs from "fs";
import { Dictionary } from "lodash";
import { parse } from "csv";
import { NodeJsClient } from "@smithy/types";
import { Injectable } from "@nestjs/common";
import { PassThrough } from "node:stream";

export type CsvRowCallback = (row: Dictionary<string>) => void | Promise<void>;

const PRESIGNED_URL_TIMEOUT = 3600; // 1 hour

@Injectable()
export class FileService {
  private readonly logger = new TMLogger(FileService.name);
  private readonly s3: NodeJsClient<S3Client>;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>("AWS_ENDPOINT");
    this.s3 = new S3Client({
      endpoint,
      region: configService.get<string>("AWS_REGION"),
      credentials: {
        accessKeyId: configService.get<string>("AWS_ACCESS_KEY_ID") ?? "",
        secretAccessKey: configService.get<string>("AWS_SECRET_ACCESS_KEY") ?? ""
      },
      // required for local dev when accessing the minio docker container
      forcePathStyle: (endpoint ?? "").includes("localhost") ? true : undefined
    }) as NodeJsClient<S3Client>;
  }

  async uploadFile(
    buffer: Buffer<ArrayBufferLike>,
    bucket: string,
    path: string,
    mimetype: string,
    acl: ObjectCannedACL = "public-read"
  ) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: mimetype,
        ACL: acl
      })
    );
    this.logger.log(`Uploaded ${bucket}/${path} to S3`);
  }

  uploadStream(bucket: string, key: string, mimeType: string) {
    const stream = new PassThrough();
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: mimeType
      }
    });
    // have to call done in order to start the writing process.
    upload.done().catch(error => this.logger.error(`Error uploading stream to S3: ${error}`));
    return stream;
  }

  async copyRemoteFile(bucket: string, fromPath: string, toPath: string, mimeType?: string) {
    try {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: toPath,
          CopySource: `${bucket}/${fromPath}`,
          ContentType: mimeType,
          ACL: "public-read"
        })
      );
      this.logger.log(`Copied ${fromPath} to ${toPath} in S3 bucket ${bucket}.`);
    } catch (error) {
      this.logger.error(`Error copying file from ${fromPath} to ${toPath} in S3 bucket ${bucket} [${error}]`);
    }
  }

  async remoteFileExists(bucket: string, key: string) {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );
      return true; // the request is successful only if the object exists.
    } catch (error) {
      if (!(error instanceof NotFound)) {
        this.logger.error(`Error getting object head ${bucket}/${key} [${error}]`);
      }
      return false;
    }
  }

  async generatePresignedUrl(bucket: string, key: string) {
    return await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      }),
      { expiresIn: PRESIGNED_URL_TIMEOUT }
    );
  }

  async deleteRemoteFile(bucket: string, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    this.logger.log(`Deleted ${bucket}/${key} from S3`);
  }

  /**
   * Read a CSV file. If bucket is not provided, the file path is expected to be on the local file
   * system (useful for local REPL testing - should not be used in AWS).
   *
   * When the promise returned from this method resolves, the CSV file has been fully processed.
   */
  /* istanbul ignore next */
  async parseCsv(onRow: CsvRowCallback, path: string, bucket?: string) {
    const stream = bucket == null ? fs.createReadStream(path) : await this.readRemoteFile(bucket, path);
    if (stream == null) {
      throw new Error(`No stream found [path=${path}, bucket=${bucket}]`);
    }

    for await (const row of stream.pipe(parse({ columns: true, skipEmptyLines: true, trim: true, bom: true }))) {
      await onRow(row);
    }
  }

  /* istanbul ignore next */
  async readRemoteFile(bucket: string, path: string) {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
    if (response.Body == null) throw new Error(`No stream found [path=${path}, bucket=${bucket}]`);
    return response.Body;
  }
}
