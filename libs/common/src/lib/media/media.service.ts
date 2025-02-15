import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Media } from "@terramatch-microservices/database/entities";

@Injectable()
export class MediaService {
  constructor(private readonly configService: ConfigService) {}

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
    return `${baseUrl}/conversions/${fileName.slice(0, lastIndex)}-${conversion}${fileName.slice(lastIndex)}`;
  }
}
