import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import "multer";
import sharp from "sharp";
import {
  EntityMediaOwnerClass,
  MEDIA_OWNER_MODELS,
  MediaConfiguration,
  MediaOwnerModel,
  MediaOwnerType,
  ValidationKey
} from "@terramatch-microservices/database/constants/media-owners";
import { MediaRequestAttributes } from "../entities/dto/media-request.dto";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";

const MIME_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/heif": "heif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-word": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "video/mp4": "mp4"
};

const SUPPORTS_THUMBNAIL = ["image/png", "image/jpeg", "image/heif", "image/heic"];

const VALIDATION: {
  VALIDATION_RULES: Record<ValidationKey, string>;
  VALIDATION_FILE_TYPES: Record<ValidationKey, "media" | "documents">;
} = {
  VALIDATION_RULES: {
    "logo-image": "mimes:jpg,png",
    "cover-image": "mimes:jpg,png",
    "cover-image-with-svg": "mimes:jpg,png,svg",
    photos: "mimes:jpg,png,mp4",
    pdf: "mimes:pdf",
    documents: "mimes:pdf,xls,xlsx,csv,txt,doc,docx,bin",
    "general-documents": "mimes:pdf,xls,xlsx,csv,txt,png,jpg,doc,mp4,docx,bin|size:5MB",
    spreadsheet: "mimes:pdf,xls,xlsx,csv,txt|size:5MB",
    thumbnail: "mimes:jpg,png"
  },
  VALIDATION_FILE_TYPES: {
    "logo-image": "media",
    thumbnail: "media",
    "cover-image": "media",
    "cover-image-with-svg": "media",
    photos: "media",
    pdf: "media",
    documents: "documents",
    "general-documents": "documents",
    spreadsheet: "documents"
  }
};

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

    const configuration = this.getConfiguration(mediaOwnerModel, collection);

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
        const filename = `${originalname.substring(0, extensionIdx)}-thumbnail${originalname.substring(extensionIdx)}`;
        await this.mediaService.uploadFile(thumbnail, `${media.id}/conversions/${filename}`, mimetype);
        await media.update({ generatedConversions: { thumbnail: true } });
      }

      return media;
    } catch (error) {
      this.logger.error(`Error uploading file to S3 [${error}]`);
      await media.destroy({ force: true });
      throw error;
    }
  }

  private getConfiguration(
    entityModel: EntityMediaOwnerClass<MediaOwnerModel>,
    collection: string
  ): MediaConfiguration {
    const configuration = Object.values(entityModel.MEDIA).find(({ dbCollection }) => dbCollection === collection);
    if (configuration == null) {
      throw new InternalServerErrorException(`Configuration for collection ${collection} not found`);
    }

    return configuration;
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

    return VALIDATION.VALIDATION_FILE_TYPES[configuration.validation];
  }

  private validateFile(file: Express.Multer.File, configuration: MediaConfiguration): boolean {
    if (configuration.validation == null) {
      return false;
    }

    const validationRules = VALIDATION.VALIDATION_RULES[configuration.validation];

    const validations = validationRules.split("|");

    const mimeTypeValidation = validations.find(validation => validation.startsWith("mimes:"));
    const sizeValidation = validations.find(validation => validation.startsWith("size:"));

    if (mimeTypeValidation != null) {
      const mimeTypes: string[] = mimeTypeValidation.split(":")[1].split(",");

      const abbreviatedMimeType = MIME_TYPES[file.mimetype as keyof typeof MIME_TYPES];
      if (!mimeTypes.includes(abbreviatedMimeType)) {
        this.logger.error(`Invalid file type: ${file.mimetype}`);
        throw new TranslatableException(`Invalid file type: ${file.mimetype}`, "MIMES", {
          values: mimeTypes.join(", ")
        });
      }
    }

    if (sizeValidation != null) {
      const size = sizeValidation.split(":")[1];
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
