import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { TMLogger } from "../util/tm-logger";
import { ConfigService } from "@nestjs/config";
import fs from "fs";
import { Dictionary } from "lodash";
import { parse } from "csv";
import { NodeJsClient } from "@smithy/types";
import { Injectable } from "@nestjs/common";

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

  async deleteRemoteFile(bucket: string, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    this.logger.log(`Deleted ${bucket}/${key} from S3`);
  }

  /**
   * Read a CSV file. If bucket is not provided, the file path is expected to be on the local file
   * system (useful for local REPL testing - should not be used in AWS).
   */
  /* istanbul ignore next */
  async parseCsv(onRow: (row: Dictionary<string>) => void, path: string, bucket?: string) {
    const stream = bucket == null ? fs.createReadStream(path) : await this.readRemoteFile(bucket, path);
    if (stream == null) {
      throw new Error(`No stream found [path=${path}, bucket=${bucket}]`);
    }

    await new Promise((resolve, reject) => {
      stream
        .pipe(parse({ columns: true, skipEmptyLines: true, trim: true, bom: true }))
        .on("data", onRow)
        .on("error", reject)
        .on("end", resolve);
    });
  }

  /* istanbul ignore next */
  async readRemoteFile(bucket: string, path: string) {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
    if (response.Body == null) throw new Error(`No stream found [path=${path}, bucket=${bucket}]`);
    return response.Body;
  }
}
