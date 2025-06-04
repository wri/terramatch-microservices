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
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import "multer";

export interface ExtractedRequestData {
  isPublic: boolean;
  lat: number;
  lng: number;
}

interface MediaConfiguration {
  validation: string;
  validationFileTypes: string;
}

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
    file: Express.Multer.File,
    body: ExtractedRequestData
  ) {
    if (file == null) {
      throw new BadRequestException("No file provided");
    }

    const entityModel = ENTITY_MODELS[entity];

    const configuration = this.getConfiguration(entityModel, collection);

    this.validateFile(file, configuration);

    const buffer = file.buffer;

    await this.mediaService.uploadFile(buffer, file.filename, file.mimetype);

    const user = await User.findOne({
      where: { id: this.entitiesService.userId },
      attributes: ["firstName", "lastName"]
    });

    const media: Partial<Media> = {
      collectionName: collection,
      modelType: entityModel.LARAVEL_TYPE,
      modelId: model.id,
      name: file.filename,
      fileName: file.filename,
      mimeType: file.mimetype,
      fileType: this.getMediaType(file),
      isPublic: body.isPublic,
      lat: body.lat,
      lng: body.lng,
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

    const dbMedia = await Media.create(media as Media);

    return new MediaDto(dbMedia, {
      url: this.mediaService.getUrl(dbMedia),
      thumbUrl: this.mediaService.getUrl(dbMedia, "thumbnail"),
      entityType: entity,
      entityUuid: model.uuid
    });
  }

  private getConfiguration(entity: EntityClass<EntityModel>, collection: string): MediaConfiguration {
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
      return "document";
    }

    if (images.includes(file.mimetype) || videos.includes(file.mimetype)) {
      return "media";
    }

    return null;
  }

  private validateFile(file: any, configuration: MediaConfiguration) {
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

  // private async extractRequestData(req: any): Promise<ExtractedRequestData> {
  //   const parts = req.parts();

  //   const extraFields: ExtractedRequestData = {
  //     file: null,
  //     isPublic: false,
  //     lat: 0,
  //     lng: 0
  //   };

  //   for await (const part of parts) {
  //     if ((part as any).file != null) {
  //       // @ts-ignore
  //       extraFields.file = part;
  //     } else {
  //       extraFields[part.fieldname] = (part as any).value;
  //     }
  //   }

  //   return extraFields;
  // }
}
