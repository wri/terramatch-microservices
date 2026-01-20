import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "mediaBulkResponses" })
export class MediaBulkResponseDto {
  constructor(index: number, error: string) {
    this.index = index;
    this.error = error;
  }

  @IsString()
  @ApiProperty({ description: "The index of the media" })
  index: number;

  @IsString()
  @ApiProperty({ description: "The error message" })
  error: string;
}
