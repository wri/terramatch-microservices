import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "fileDownloads", id: "string" })
export class FileDownloadDto {
  constructor(url: string) {
    this.url = url;
  }

  @ApiProperty()
  url: string;
}
