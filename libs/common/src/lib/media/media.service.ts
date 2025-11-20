import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Media, User } from "@terramatch-microservices/database/entities";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { TMLogger } from "../util/tm-logger";
import "multer";
import {
  abbreviatedValidationMimeTypes,
  FILE_VALIDATION,
  MEDIA_OWNER_MODELS,
  mediaConfiguration,
  MediaConfiguration,
  MediaOwnerModel,
  MediaOwnerType,
  MIME_TYPE_ABBREVIATIONS,
  MimeType,
  sizeValidation
} from "@terramatch-microservices/database/constants/media-owners";
import { TranslatableException } from "../exceptions/translatable.exception";
import sharp from "sharp";

type MediaAttributes = {
  isPublic: boolean;
  lat?: number | null;
  lng?: number | null;
};

const SUPPORTS_THUMBNAIL = ["image/png", "image/jpeg", "image/heif", "image/heic"];

@Injectable()
export class MediaService {
  private logger = new TMLogger(MediaService.name);

  private readonly s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.endpoint;
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

  get endpoint() {
    return this.configService.get<string>("AWS_ENDPOINT");
  }

  get bucket() {
    return this.configService.get<string>("AWS_BUCKET");
  }

  async createMedia(
    model: MediaOwnerModel,
    entity: MediaOwnerType,
    creatorId: number,
    collection: string,
    file: Express.Multer.File,
    data: MediaAttributes = { isPublic: true }
  ) {
    const mediaOwnerModel = MEDIA_OWNER_MODELS[entity];

    const configuration = mediaConfiguration(entity, collection);
    if (configuration == null) {
      throw new InternalServerErrorException(`Configuration for collection ${collection} not found`);
    }

    this.validateFile(file, configuration);

    const user = await User.findOne({
      where: { id: creatorId },
      attributes: ["firstName", "lastName"]
    });

    const media = await Media.create({
      collectionName: collection,
      modelType: mediaOwnerModel.LARAVEL_TYPE,
      modelId: model.id,
      name: file.originalname,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileType: this.getMediaType(file, configuration),
      isPublic: data.isPublic,
      customProperties: { custom_headers: { ACL: "public-read" } },
      generatedConversions: {},
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      size: file.size,
      createdBy: creatorId,
      photographer: user?.fullName ?? null
    });

    await media.save();
    try {
      const { buffer, originalname, mimetype } = file;

      const supportsThumbnail = media.mimeType != null && SUPPORTS_THUMBNAIL.includes(media.mimeType);
      const original = supportsThumbnail
        ? // orient the photo according to the EXIF metadata. rotate() with no arguments uses the
          // EXIF orientation tags to set up the photo the way it's meant to be viewed.
          await sharp(buffer).rotate().keepExif().toBuffer()
        : buffer;
      await this.uploadFile(original, `${media.id}/${originalname}`, mimetype);

      if (supportsThumbnail) {
        const thumbnail = await sharp(original)
          .resize({ width: 350, height: 211, fit: "inside" })
          .keepExif()
          .toBuffer();
        const extensionIdx = originalname.lastIndexOf(".");
        const extension = originalname.substring(extensionIdx);
        const filename = `${originalname.substring(0, extensionIdx)}-thumbnail${extension}`;
        await this.uploadFile(thumbnail, `${media.id}/conversions/${filename}`, mimetype);
        await media.update({
          generatedConversions: { thumbnail: true },
          customProperties: { ...media.customProperties, thumbnailExtension: extension }
        });
      }

      return media;
    } catch (error) {
      this.logger.error(`Error uploading file to S3 [${error}]`);
      await media.destroy({ force: true });
      throw error;
    }
  }

  async uploadFile(buffer: Buffer<ArrayBufferLike>, path: string, mimetype: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: buffer,
      ContentType: mimetype,
      ACL: "public-read"
    });

    await this.s3.send(command);
    this.logger.log(`Uploaded ${path} to S3`);
  }

  // Duplicates the base functionality of Spatie's media.getFullUrl() method, skipping some
  // complexity by making some assumptions that hold true for our use of Spatie (like how
  // we only use the "s3" drive type.
  public getUrl(media: Media, conversion?: string) {
    const endpoint = this.endpoint;
    const bucket = this.bucket;
    const baseUrl = `${endpoint}/${bucket}/${media.id}`;
    const { fileName } = media;
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

  private getMediaType(file: Express.Multer.File, configuration: MediaConfiguration) {
    const documents = ["application/pdf", "application/vnd.ms-excel", "text/plain", "application/msword"];
    const images = ["image/png", "image/jpeg", "image/heif", "image/heic", "image/svg+xml"];
    const videos = ["video/mp4"];

    if (documents.includes(file.mimetype)) {
      return "documents";
    }

    if (images.includes(file.mimetype) || videos.includes(file.mimetype)) {
      return "media";
    }

    return FILE_VALIDATION.VALIDATION_FILE_TYPES[configuration.validation];
  }

  private validateFile(file: Express.Multer.File, configuration: MediaConfiguration): boolean {
    if (configuration.validation == null) {
      return false;
    }

    const mimeTypes = abbreviatedValidationMimeTypes(configuration.validation);
    if (mimeTypes != null) {
      const abbreviatedMimeType = MIME_TYPE_ABBREVIATIONS[file.mimetype as MimeType];
      if (!mimeTypes.includes(abbreviatedMimeType)) {
        this.logger.error(`Invalid file type: ${file.mimetype}`);
        throw new TranslatableException(`Invalid file type: ${file.mimetype}`, "MIMES", {
          values: mimeTypes.join(", ")
        });
      }
    }

    const size = sizeValidation(configuration.validation);
    if (size != null) {
      const sizeInMB = parseInt(size.replace("MB", ""));
      const sizeInBytes = sizeInMB * 1024 * 1024;

      if (file.size > sizeInBytes) {
        throw new TranslatableException(`File size must be less than ${size}`, "FILE_SIZE", { max: sizeInMB });
      }

      return true;
    }

    return false;
  }
}
