import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  User
} from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { MediaUpdateBody } from "../dto/media-update.dto";
import "multer";
import { Op, Transaction } from "sequelize";
import {
  abbreviatedValidationMimeTypes,
  FILE_VALIDATION,
  mediaConfiguration,
  MediaConfiguration,
  MediaOwnerModel,
  MediaOwnerType,
  MIME_TYPE_ABBREVIATIONS,
  MimeType,
  sizeValidation
} from "@terramatch-microservices/database/constants/media-owners";
import { EntityModel, getProjectId } from "@terramatch-microservices/database/constants/entities";
import { TranslatableException } from "../exceptions/translatable.exception";
import sharp from "sharp";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Readable } from "stream";
import path from "path";
import { FileService } from "../file/file.service";

export type MediaAttributes = {
  isPublic: boolean;
  lat?: number | null;
  lng?: number | null;
};

const SUPPORTS_THUMBNAIL = ["image/png", "image/jpeg", "image/heif", "image/heic"];

const MIME_TYPES = {
  documents: ["application/pdf", "application/vnd.ms-excel", "text/plain", "application/msword"],
  images: ["image/png", "image/jpeg", "image/heif", "image/heic", "image/svg+xml"],
  videos: ["video/mp4"]
};

@Injectable()
export class MediaService {
  private logger = new TMLogger(MediaService.name);

  constructor(private readonly fileService: FileService, private readonly configService: ConfigService) {}

  get endpoint() {
    const endpoint = this.configService.get<string>("AWS_ENDPOINT");
    if (endpoint == null) throw new InternalServerErrorException("AWS_ENDPOINT is not set");
    return endpoint;
  }

  get bucket() {
    const bucket = this.configService.get<string>("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET is not set");
    return bucket;
  }

  async getProjectForModel(model: MediaOwnerModel) {
    const projectId = await getProjectId(model as EntityModel);
    const project =
      projectId == null
        ? null
        : await Project.findOne({ where: { id: projectId }, attributes: ["id", "frameworkKey"] });
    if (project == null) throw new BadRequestException(`Media is not part of a project.`);
    return project;
  }

  async unsetMediaCoverForProject(media: Media, project: Project) {
    const whereClause = {
      isCover: true,
      id: {
        [Op.ne]: media.id
      },
      [Op.or]: [
        {
          modelType: Project.LARAVEL_TYPE,
          modelId: project.id
        },
        {
          modelType: Site.LARAVEL_TYPE,
          modelId: {
            [Op.in]: Site.idsSubquery(project.id)
          }
        },
        {
          modelType: Nursery.LARAVEL_TYPE,
          modelId: {
            [Op.in]: Nursery.idsSubquery(project.id)
          }
        },
        {
          modelType: ProjectReport.LARAVEL_TYPE,
          modelId: {
            [Op.in]: ProjectReport.idsSubquery(project.id)
          }
        },
        {
          modelType: SiteReport.LARAVEL_TYPE,
          modelId: {
            [Op.in]: SiteReport.idsSubquery(Site.idsSubquery(project.id))
          }
        },
        {
          modelType: NurseryReport.LARAVEL_TYPE,
          modelId: {
            [Op.in]: NurseryReport.idsSubquery(Nursery.idsSubquery(project.id))
          }
        }
      ]
    };

    const medias = await Media.findAll({ where: whereClause });
    const mediaIds = medias.map(m => m.id);
    await Media.update({ isCover: false }, { where: { id: mediaIds } });
    for (const media of medias) {
      // update the models in memory to match the bulk query above
      media.isCover = false;
    }
    return medias;
  }

  async updateMedia(media: Media, updatePayload: MediaUpdateBody) {
    return await media.update(updatePayload.data.attributes);
  }

  // Duplicates the base functionality of Spatie's media.getFullUrl() method, skipping some
  // complexity by making some assumptions that hold true for our use of Spatie (like how
  // we only use the "s3" drive type).
  public getUrl(media: Media, conversion?: string) {
    const endpoint = this.endpoint;
    if (conversion == null) return `${endpoint}${this.filePath(media)}`;
    return media.generatedConversions[conversion] == null
      ? null
      : `${endpoint}/${this.conversionFilePath(media, conversion)}`;
  }

  async createMedia(
    model: MediaOwnerModel,
    entity: MediaOwnerType,
    creatorId: number,
    collection: string,
    file: Express.Multer.File,
    data: MediaAttributes = { isPublic: true },
    transaction?: Transaction
  ) {
    const configuration = mediaConfiguration(entity, collection);
    if (configuration == null) {
      throw new InternalServerErrorException(`Configuration for collection ${collection} not found`);
    }

    this.validateFile(file, configuration);

    const user = await User.findOne({
      where: { id: creatorId },
      attributes: ["firstName", "lastName"]
    });

    const media = await Media.create(
      {
        collectionName: collection,
        modelType: laravelType(model),
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
      },
      { transaction }
    );

    try {
      const { buffer, originalname, mimetype } = file;

      const supportsThumbnail = media.mimeType != null && SUPPORTS_THUMBNAIL.includes(media.mimeType);
      const original = supportsThumbnail
        ? // orient the photo according to the EXIF metadata. rotate() with no arguments uses the
          // EXIF orientation tags to set up the photo the way it's meant to be viewed.
          await sharp(buffer).rotate().keepExif().toBuffer()
        : buffer;
      await this.fileService.uploadFile(original, this.bucket, `${media.id}/${originalname}`, mimetype);

      if (supportsThumbnail) {
        const thumbnail = await sharp(original)
          .resize({ width: 350, height: 211, fit: "inside" })
          .keepExif()
          .toBuffer();
        const extensionIdx = originalname.lastIndexOf(".");
        const extension = originalname.substring(extensionIdx);
        const filename = `${originalname.substring(0, extensionIdx)}-thumbnail${extension}`;
        await this.fileService.uploadFile(thumbnail, this.bucket, `${media.id}/conversions/${filename}`, mimetype);
        await media.update(
          {
            generatedConversions: { thumbnail: true },
            customProperties: { ...media.customProperties, thumbnailExtension: extension }
          },
          { transaction }
        );
      }

      return media;
    } catch (error) {
      this.logger.error(`Error uploading file to S3 [${error}]`);
      if (transaction == null) {
        await media.destroy({ force: true });
      }
      throw error;
    }
  }

  async duplicateMedia(media: Media, newOwner: MediaOwnerModel) {
    const copy = await Media.create({
      collectionName: media.collectionName,
      modelType: laravelType(newOwner),
      modelId: newOwner.id,
      name: media.name,
      fileName: media.fileName,
      mimeType: media.mimeType,
      fileType: media.fileType,
      isPublic: media.isPublic,
      customProperties: { custom_headers: { ACL: "public-read" } },
      generatedConversions: media.generatedConversions,
      lat: media.lat,
      lng: media.lng,
      size: media.size,
      createdBy: media.createdBy,
      photographer: media.photographer
    });

    await this.fileService.copyRemoteFile(
      this.bucket,
      `${media.id}/${media.fileName}`,
      `${copy.id}/${copy.fileName}`,
      copy.mimeType ?? undefined
    );
    await Promise.all(
      Object.entries(copy.generatedConversions).map(async ([conversion, generated]: [string, boolean]) => {
        if (!generated) return;

        const fromPath = this.conversionFilePath(media, conversion);
        const toPath = this.conversionFilePath(copy, conversion);
        if (fromPath != null && toPath != null)
          return this.fileService.copyRemoteFile(this.bucket, fromPath, toPath, copy.mimeType ?? undefined);
      })
    );

    return copy;
  }

  private filePath(media: Media) {
    return `/${this.bucket}/${media.id}/${media.fileName}`;
  }

  private conversionFilePath(media: Media, conversion: string) {
    if (media.generatedConversions[conversion] == null) return null;

    const lastIndex = media.fileName.lastIndexOf(".");
    const baseFileName = media.fileName.slice(0, lastIndex);

    // For thumbnails, Spatie Media Library in PHP always generates .jpg files regardless of
    // original extension For images uploaded via the file upload service, we specify the extension
    // in customProperties.
    const extension =
      (media.customProperties[`${conversion}Extension`] as string | undefined) ??
      (conversion === "thumbnail" ? ".jpg" : media.fileName.slice(lastIndex));

    return `${this.bucket}/${media.id}/conversions/${baseFileName}-${conversion}${extension}`;
  }

  private getMediaType(file: Express.Multer.File, configuration: MediaConfiguration) {
    if (MIME_TYPES.documents.includes(file.mimetype)) {
      return "documents";
    }

    if (MIME_TYPES.images.includes(file.mimetype) || MIME_TYPES.videos.includes(file.mimetype)) {
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

  async getMedia(uuid: string) {
    const media = await Media.findOne({
      where: { uuid }
    });
    if (media == null) throw new NotFoundException();
    return media;
  }

  async deleteMediaFromS3(media: Media) {
    this.logger.log(`Deleting media ${media.uuid} from S3`);
    await this.fileService.deleteRemoteFile(this.bucket, `${media.id}/${media.fileName}`);
  }

  async deleteMedia(media: Media) {
    await this.deleteMediaFromS3(media);
    await media.destroy();

    return media;
  }

  async deleteMediaByUuid(uuid: string) {
    const media = await Media.findOne({
      where: { uuid }
    });
    if (media == null) throw new NotFoundException();

    return this.deleteMedia(media);
  }

  async getMedias(uuids: string[]) {
    return Media.findAll({
      where: { uuid: { [Op.in]: uuids } }
    });
  }

  public async fetchDataFromUrlAsMulterFile(url: string): Promise<Express.Multer.File> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (error) {
      throw new BadRequestException(`Failed to download file from URL ${url}: ${error.message}`);
    }

    if (!res.ok) {
      throw new BadRequestException(`Failed to download file from URL ${url}: ${res.statusText}`);
    }

    const filename = path.basename(new URL(url).pathname);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const allowedMimeTypes = ["image/png", "image/jpg", "image/jpeg", "image/heif", "image/heic"];

    if (!allowedMimeTypes.includes(res.headers.get("content-type") ?? "")) {
      throw new BadRequestException("Invalid file type");
    }
    const contentType = res.headers.get("content-type") ?? "";
    const contentLength =
      res.headers.get("content-length") == null ? buffer.length : Number(res.headers.get("content-length"));

    return {
      fieldname: "uploadFile",
      originalname: url.split("/").pop() ?? "downloaded-file",
      encoding: "7bit",
      mimetype: contentType,
      size: contentLength,
      buffer,
      stream: Readable.from(buffer),
      destination: "",
      filename,
      path: ""
    };
  }
}
