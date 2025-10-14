import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Media } from "@terramatch-microservices/database/entities";
import { PutObjectCommand, S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { TMLogger } from "../util/tm-logger";
import "multer";

@Injectable()
export class MediaService {
  private logger = new TMLogger(MediaService.name);

  private readonly s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get<string>("AWS_REGION"),
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID") ?? "",
        secretAccessKey: this.configService.get<string>("AWS_SECRET_ACCESS_KEY") ?? ""
      }
    });
  }

  async uploadFile(file: Express.Multer.File, bucket: string = this.configService.get<string>("AWS_BUCKET") ?? "") {
    const { buffer, originalname, mimetype } = file;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: originalname,
      Body: buffer,
      ContentType: mimetype,
      ACL: "public-read"
    });

    await this.s3.send(command);
    this.logger.log(`Uploaded ${originalname} to S3`);
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

    if (!media.generatedConversions[conversion]) return null;

    const lastIndex = fileName.lastIndexOf(".");
    const baseFileName = fileName.slice(0, lastIndex);

    // For thumbnails, Spatie Media Library always generates .jpg files regardless of original extension
    const extension = conversion === "thumbnail" ? ".jpg" : fileName.slice(lastIndex);

    return `${baseUrl}/conversions/${baseFileName}-${conversion}${extension}`;
  }

  async deleteMedia(uuid: string) {
    const media = await Media.findOne({
      where: { uuid }
    });
    if (media == null) throw new NotFoundException();

    const key = `${media.id}/${media.fileName}`;

    console.log(key);
    console.log(this.configService.get<string>("AWS_BUCKET") ?? "");

    const command = new DeleteObjectCommand({
      Bucket: this.configService.get<string>("AWS_BUCKET") ?? "",
      Key: key
    });

    this.logger.log(`Deleting media ${uuid} from S3`);
    await this.s3.send(command);
    await media.destroy();

    return media;
  }
}
