import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { PutObjectCommand, S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { TMLogger } from "../util/tm-logger";
import { MediaUpdateBody } from "../dto/media-update.dto";
import "multer";
import { Op } from "sequelize";
import { MediaOwnerModel } from "@terramatch-microservices/database/constants/media-owners";
import { EntityModel, getProjectId } from "@terramatch-microservices/database/constants/entities";

@Injectable()
export class MediaService {
  private logger = new TMLogger(MediaService.name);

  private readonly s3: S3Client;

  constructor(private readonly configService: ConfigService) {
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

  async uploadFile(buffer: Buffer<ArrayBufferLike>, path: string, mimetype: string) {
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

  // Duplicates the base functionality of Spatie's media.getFullUrl() method, skipping some
  // complexity by making some assumptions that hold true for our use of Spatie (like how
  // we only use the "s3" drive type.
  public getUrl(media: Media, conversion?: string) {
    const endpoint = this.configService.get<string>("AWS_ENDPOINT");
    const bucket = this.configService.get<string>("AWS_BUCKET");
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

  async getMedia(uuid: string) {
    const media = await Media.findOne({
      where: { uuid }
    });
    if (media == null) throw new NotFoundException();
    return media;
  }

  async deleteMedia(media: Media) {
    const key = `${media.id}/${media.fileName}`;

    const command = new DeleteObjectCommand({
      Bucket: this.configService.get<string>("AWS_BUCKET") ?? "",
      Key: key
    });

    this.logger.log(`Deleting media ${media.uuid} from S3`);
    await this.s3.send(command);
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
}
