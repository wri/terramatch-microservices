import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ENTITY_MODELS,
  EntityClass,
  EntityModel,
  EntityType
} from "@terramatch-microservices/database/constants/entities";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { MediaDto } from "../entities/dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { MediaExtraProperties } from "../entities/dto/media-extra-properties";
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

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

  constructor(private readonly mediaService: MediaService, protected readonly entitiesService: EntitiesService) {}

  public async uploadFile(
    model: EntityModel,
    entity: EntityType,
    collection: string,
    file: any,
    extraFields: MediaExtraProperties
  ) {
    const entityModel = ENTITY_MODELS[entity];
    const configuration = this.getConfiguration(entityModel, collection);

    this.validateFile(file, configuration);

    const buffer = await file.toBuffer();

    await this.mediaService.uploadFile(buffer, file.filename, file.mimetype);

    this.logger.log(`Uploaded file ${file.filename} to S3 ${this.mediaService.getUrl(file.filename)}`);

    const user = await User.findOne({
      where: { id: this.entitiesService.userId },
      attributes: ["firstName", "lastName"]
    });

    const media: any = {
      collectionName: collection,
      modelType: entityModel.LARAVEL_TYPE,
      modelId: model.id,
      name: file.filename,
      fileName: file.filename,
      mimeType: file.mimetype,
      fileType: this.getMediaType(file),
      isPublic: extraFields.isPublic,
      lat: extraFields.lat,
      lng: extraFields.lng,
      disk: "s3",
      size: buffer.length,
      manipulations: [],
      generatedConversions: {},
      customProperties: {},
      responsiveImages: [],
      orderColumn: null,
      description: null,
      photographer: user?.fullName ?? null,
      createdBy: this.entitiesService.userId
    };

    const dbMedia = await Media.create(media);

    return new MediaDto(dbMedia, {
      url: this.mediaService.getUrl(dbMedia),
      thumbUrl: this.mediaService.getUrl(dbMedia, "thumbnail"),
      entityType: entity,
      entityUuid: model.uuid
    });
  }

  private getConfiguration(entity: EntityClass<EntityModel>, collection: string) {
    const configuration = (entity as any).MEDIA[collection];
    if (configuration == null) {
      throw new Error(`Configuration for collection ${collection} not found`);
    }

    return configuration;
  }

  private getMediaType(file: any) {
    const documents = ["application/pdf", "application/vnd.ms-excel", "text/plain", "application/msword"];
    const images = ["image/png", "image/jpeg", "image/heif", "image/heic", "image/svg+xml"];
    const videos = ["video/mp4"];

    if (documents.includes(file.mimetype)) {
      return "documents";
    }

    if (images.includes(file.mimetype) || videos.includes(file.mimetype)) {
      return "media";
    }

    return null;
  }

  private validateFile(file: any, configuration: any) {
    const validationFileTypes = VALIDATION.VALIDATION_FILE_TYPES[configuration.validation];
    const validationRules = VALIDATION.VALIDATION_RULES[validationFileTypes];

    const validations = validationRules.split("|");

    const mimeTypeValidation = validations.find(validation => validation.startsWith("mimes:"));
    const sizeValidation = validations.find(validation => validation.startsWith("size:"));

    if (mimeTypeValidation != null) {
      const mimeType = mimeTypeValidation.split(":")[1];

      // TODO: review why file.mimetype is not in the list
      if (!file.mimetype.startsWith(mimeType)) {
        this.logger.error(`Invalid file type: ${file.mimetype}`);
        // throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
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
