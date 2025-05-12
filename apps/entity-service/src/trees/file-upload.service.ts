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
  constructor(private readonly mediaService: MediaService) {}

  public async uploadFile(model: EntityModel, entity: EntityType, collection: string, file: any) {
    const entityModel = ENTITY_MODELS[entity];
    const configuration = this.getConfiguration(entityModel, collection);

    this.validateFile(file, configuration);

    const buffer = await file.toBuffer();
    const s3Result = await this.mediaService.uploadFile(buffer, file.filename, file.mimetype);

    const media: Partial<Media> = {
      collectionName: collection,
      modelType: entityModel.LARAVEL_TYPE,
      modelId: model.id,
      name: file.filename,
      fileName: file.filename,
      mimeType: file.mimetype,
      isPublic: true,
      disk: "s3",
      size: buffer.length,
      manipulations: [],
      generatedConversions: {},
      customProperties: {},
      responsiveImages: [],
      orderColumn: null,
      photographer: null,
      description: null,
      createdBy: null
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

  private validateFile(file: any, configuration: any) {
    const validationFileTypes = VALIDATION.VALIDATION_FILE_TYPES[configuration.validation];
    const validationRules = VALIDATION.VALIDATION_RULES[validationFileTypes];

    const validations = validationRules.split("|");

    const mimeTypeValidation = validations.find(validation => validation.startsWith("mimes:"));
    const sizeValidation = validations.find(validation => validation.startsWith("size:"));

    if (mimeTypeValidation) {
      const mimeType = mimeTypeValidation.split(":")[1];
      if (!file.mimetype.startsWith(mimeType)) {
        throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
      }
    }

    if (sizeValidation) {
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
