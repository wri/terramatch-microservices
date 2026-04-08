import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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

export type CsvRowCallback = (row: Dictionary<string>) => void | Promise<void>;

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
   * Lists objects under `prefix` and deletes those older than `cutoff` (by S3 LastModified).
   * Used for scheduled cleanup of temporary exports stored under a known prefix.
   */
  async deleteObjectsInPrefixOlderThan(bucket: string, prefix: string, cutoff: Date): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      );
      const contents = response.Contents ?? [];
      const keysToDelete: string[] = [];
      for (const obj of contents) {
        if (obj.Key == null) continue;
        if (obj.LastModified == null || obj.LastModified >= cutoff) continue;
        keysToDelete.push(obj.Key);
      }
      if (keysToDelete.length > 0) {
        const delResponse = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keysToDelete.map(Key => ({ Key })), Quiet: true }
          })
        );
        const errs = delResponse.Errors ?? [];
        if (errs.length > 0) {
          this.logger.error(`S3 DeleteObjects reported errors: ${JSON.stringify(errs)}`);
          throw new Error(`Failed to delete ${errs.length} S3 object(s) under ${bucket}/${prefix}`);
        }
        deleted += keysToDelete.length;
      }
      continuationToken = response.IsTruncated === true ? response.NextContinuationToken : undefined;
    } while (continuationToken != null);
    return deleted;
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
