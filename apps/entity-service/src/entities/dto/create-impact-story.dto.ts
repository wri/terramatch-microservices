import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { StoreImpactStoryAttributes } from "./update-impact-story.dto";

export class CreateImpactStoryAttributes extends StoreImpactStoryAttributes {
  @IsString()
  @IsNotEmpty()
  @Length(1, 70, { message: "Title must be between 1 and 70 characters" })
  @ApiProperty({ description: "Impact story title (max 70 characters)", maxLength: 70 })
  title: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: "Organization UUID (must exist in the database)" })
  organizationUuid: string;
}

export class CreateImpactStoryDataDto extends CreateDataDto("impactStories", CreateImpactStoryAttributes) {}

export class CreateImpactStoryBody extends JsonApiBodyDto(CreateImpactStoryDataDto) {}
