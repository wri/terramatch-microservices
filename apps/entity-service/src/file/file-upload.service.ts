import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import "multer";
import {
  MEDIA_OWNER_MODELS,
  EntityMediaOwnerClass,
  MediaOwnerModel,
  MediaOwnerType,
  MediaConfiguration
} from "@terramatch-microservices/database/constants/media-owners";

export interface ExtractedRequestData {
  isPublic: boolean;
  lat: number;
  lng: number;
}

const mappingMimeTypes = {
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-word": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};

const VALIDATION = {
  VALIDATION_RULES: {
    "logo-image": "mimes:jpg,png",
    "cover-image": "mimes:jpg,png",
    "cover-image-with-svg": "mimes:jpg,png,svg",
    photos: "mimes:jpg,png,mp4",
    pdf: "mimes:pdf",
    documents: "mimes:pdf,xls,xlsx,csv,txt,doc,docx,bin",
    "general-documents": "mimes:pdf,xls,xlsx,csv,txt,png,jpg,doc,mp4,docx,bin|size:5MB",
    spreadsheet: "mimes:pdf,xls,xlsx,csv,txt|size:5MB"
  },
  VALIDATION_FILE_TYPES: {
    "logo-image": "media",
    "cover-image": "media",
    "cover-image-with-svg": "media",
    photos: "media",
    pdf: "media",
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
    body: ExtractedRequestData
  ): Promise<Media> {
    if (file == null) {
      throw new BadRequestException("No file provided");
    }

    const mediaOwnerModel = MEDIA_OWNER_MODELS[entity];

    const configuration = this.getConfiguration(mediaOwnerModel, collection);

    this.validateFile(file, configuration);

    await this.mediaService.uploadFile(file);

    const user = await User.findOne({
      where: { id: this.entitiesService.userId },
      attributes: ["firstName", "lastName"]
    });

    const media: Partial<Media> = {
      collectionName: collection,
      modelType: mediaOwnerModel.LARAVEL_TYPE,
      modelId: model.id,
      name: file.originalname,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileType: this.getMediaType(file),
      isPublic: body.isPublic,
      lat: body.lat,
      lng: body.lng,
      disk: "s3",
      size: file.size,
      manipulations: [],
      generatedConversions: {},
      customProperties: {},
      responsiveImages: [],
      orderColumn: null,
      description: null,
      photographer: user?.fullName ?? null,
      createdBy: this.entitiesService.userId
    };

    const dbMedia = new Media(media as Media);
    return dbMedia.save();
  }

  private getConfiguration(
    entityModel: EntityMediaOwnerClass<MediaOwnerModel>,
    collection: string
  ): MediaConfiguration {
    const configuration = entityModel.MEDIA[collection];
    if (configuration == null) {
      throw new InternalServerErrorException(`Configuration for collection ${collection} not found`);
    }

    return configuration;
  }

  private getMediaType(file: Express.Multer.File) {
    const documents = ["application/pdf", "application/vnd.ms-excel", "text/plain", "application/msword"];
    const images = ["image/png", "image/jpeg", "image/heif", "image/heic", "image/svg+xml"];
    const videos = ["video/mp4"];
    console.log(file.mimetype);

    if (documents.includes(file.mimetype)) {
      return "documents";
    }

    if (images.includes(file.mimetype) || videos.includes(file.mimetype)) {
      return "media";
    }

    return undefined;
  }

  private validateFile(file: Express.Multer.File, configuration: MediaConfiguration) {
    if (configuration.validation == null) {
      return;
    }

    const validationFileTypes = VALIDATION.VALIDATION_FILE_TYPES[configuration.validation];
    const validationRules = VALIDATION.VALIDATION_RULES[validationFileTypes];

    const validations = validationRules.split("|");

    const mimeTypeValidation = validations.find(validation => validation.startsWith("mimes:"));
    const sizeValidation = validations.find(validation => validation.startsWith("size:"));

    if (mimeTypeValidation != null) {
      const mimeTypes = mimeTypeValidation.split(":")[1].split(",");

      const abbreviatedMimeType = mappingMimeTypes[file.mimetype as keyof typeof mappingMimeTypes];
      if (!mimeTypes.includes(abbreviatedMimeType)) {
        this.logger.error(`Invalid file type: ${file.mimetype}`);
        throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
      }
    }

    if (sizeValidation != null) {
      const size = sizeValidation.split(":")[1];
      const removeSuffix = size.replace("MB", "");
      const sizeInBytes = parseInt(removeSuffix) * 1024 * 1024;

      if (file.size > sizeInBytes) {
        throw new BadRequestException("File size must be less than 10MB");
      }

      return true;
    }
  }
}
