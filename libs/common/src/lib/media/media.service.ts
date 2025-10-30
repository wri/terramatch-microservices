import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Media } from "@terramatch-microservices/database/entities";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { TMLogger } from "../util/tm-logger";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import "multer";

@Injectable()
export class MediaService {
  private logger = new TMLogger(MediaService.name);

  private readonly s3: S3Client;
  private readonly isDevelopment: boolean;
  private readonly localStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = process.env["NODE_ENV"] === "development";
    this.localStoragePath = join(process.cwd(), "storage", "media");

    // Create local storage directory if it doesn't exist
    if (this.isDevelopment) {
      if (!existsSync(this.localStoragePath)) {
        mkdirSync(this.localStoragePath, { recursive: true });
      }
    }

    const endpoint = this.configService.get<string>("AWS_ENDPOINT");
    this.s3 = new S3Client({
      endpoint,
      region: this.configService.get<string>("AWS_REGION"),
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID") ?? "",
        secretAccessKey: this.configService.get<string>("AWS_SECRET_ACCESS_KEY") ?? ""
      },
      // required for local dev when accessing the minio docker container
      forcePathStyle: (endpoint ?? "").includes("localhost") ? true : undefined
    });
  }

  async uploadFile(buffer: Buffer<ArrayBufferLike>, path: string, mimetype: string) {
    if (this.isDevelopment) {
      // Save to local filesystem in development
      const fullPath = join(this.localStoragePath, path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(fullPath, buffer);
      this.logger.log(`Saved file locally: ${fullPath}`);
    } else {
      // Use S3 in production
      const command = new PutObjectCommand({
        Bucket: this.configService.get<string>("AWS_BUCKET"),
        Key: path,
        Body: buffer,
        ContentType: mimetype,
        ACL: "public-read"
      });

      await this.s3.send(command);
      this.logger.log(`Uploaded ${path} to S3`);
    }
  }

  // Duplicates the base functionality of Spatie's media.getFullUrl() method, skipping some
  // complexity by making some assumptions that hold true for our use of Spatie (like how
  // we only use the "s3" drive type.
  public getUrl(media: Media, conversion?: string) {
    const { fileName } = media;

    if (this.isDevelopment) {
      // Return local file URLs in development
      const baseUrl = `http://localhost:${process.env["ENTITY_SERVICE_PORT"] ?? 4050}/storage/media/${media.id}`;
      if (conversion == null) return `${baseUrl}/${fileName}`;

      if (!media.generatedConversions[conversion]) return null;

      const lastIndex = fileName.lastIndexOf(".");
      const baseFileName = fileName.slice(0, lastIndex);

      // For thumbnails, Spatie Media Library always generates .jpg files regardless of original extension
      const extension = conversion === "thumbnail" ? ".jpg" : fileName.slice(lastIndex);

      return `${baseUrl}/conversions/${baseFileName}-${conversion}${extension}`;
    } else {
      // Use S3 URLs in production
      const endpoint = this.configService.get<string>("AWS_ENDPOINT");
      const bucket = this.configService.get<string>("AWS_BUCKET");
      const baseUrl = `${endpoint}/${bucket}/${media.id}`;
      if (conversion == null) return `${baseUrl}/${fileName}`;
      if (media.generatedConversions[conversion] == null) return null;

      const lastIndex = fileName.lastIndexOf(".");
      const baseFileName = fileName.slice(0, lastIndex);

      // For thumbnails, Spatie Media Library in PHP always generates .jpg files regardless of
      // original extension For images uploaded via the file upload service, we specify the extension
      // in customProperties.
      const extension =
        (media.customProperties[`${conversion}Extension`] as string | undefined) ??
        (conversion === "thumbnail" ? ".jpg" : fileName.slice(lastIndex));

      return `${baseUrl}/conversions/${baseFileName}-${conversion}${extension}`;
    }
  }
}
