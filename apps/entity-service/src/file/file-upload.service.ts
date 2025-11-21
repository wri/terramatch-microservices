import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import "multer";
import sharp from "sharp";
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
import { MediaRequestAttributes } from "../entities/dto/media-request.dto";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";

const SUPPORTS_THUMBNAIL = ["image/png", "image/jpeg", "image/heif", "image/heic"];

@Injectable()
export class FileUploadService {
  private logger = new TMLogger(FileUploadService.name);

  constructor(private readonly mediaService: MediaService, private readonly entitiesService: EntitiesService) {}

  public async uploadFile(
    model: MediaOwnerModel,
    entity: MediaOwnerType,
    collection: string,
    file: Express.Multer.File,
    data: MediaRequestAttributes
  ): Promise<Media> {
    if (file == null) {
      throw new BadRequestException("No file provided");
    }

    const mediaOwnerModel = MEDIA_OWNER_MODELS[entity];

    const configuration = mediaConfiguration(entity, collection);
    if (configuration == null) {
      throw new InternalServerErrorException(`Configuration for collection ${collection} not found`);
    }

    this.validateFile(file, configuration);

    const user = await User.findOne({
      where: { id: this.entitiesService.userId },
      attributes: ["firstName", "lastName"]
    });

    const media = new Media();
    media.collectionName = collection;
    media.modelType = mediaOwnerModel.LARAVEL_TYPE;
    media.modelId = model.id;
    media.name = file.originalname;
    media.fileName = file.originalname;
    media.mimeType = file.mimetype;
    media.fileType = this.getMediaType(file, configuration);
    media.isPublic = data.isPublic;
    media.customProperties = { custom_headers: { ACL: "public-read" } };
    media.generatedConversions = {};
    media.lat = data.lat;
    media.lng = data.lng;
    media.size = file.size;
    media.createdBy = this.entitiesService.userId;
    media.photographer = user?.fullName ?? null;

    await media.save();
    try {
      const { buffer, originalname, mimetype } = file;

      const original = SUPPORTS_THUMBNAIL.includes(media.mimeType)
        ? // orient the photo according to the EXIF metadata. rotate() with no arguments uses the
          // EXIF orientation tags to set up the photo the way it's meant to be viewed.
          await sharp(buffer).rotate().keepExif().toBuffer()
        : buffer;
      await this.mediaService.uploadFile(original, `${media.id}/${originalname}`, mimetype);

      if (SUPPORTS_THUMBNAIL.includes(media.mimeType)) {
        const thumbnail = await sharp(original)
          .resize({ width: 350, height: 211, fit: "inside" })
          .keepExif()
          .toBuffer();
        const extensionIdx = originalname.lastIndexOf(".");
        const extension = originalname.substring(extensionIdx);
        const filename = `${originalname.substring(0, extensionIdx)}-thumbnail${extension}`;
        await this.mediaService.uploadFile(thumbnail, `${media.id}/conversions/${filename}`, mimetype);
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
