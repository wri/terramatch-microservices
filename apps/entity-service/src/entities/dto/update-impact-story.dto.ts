import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";

const IMPACT_STORY_STATUSES = ["draft", "published"] as const;
type ImpactStoryStatus = (typeof IMPACT_STORY_STATUSES)[number];

export class StoreImpactStoryAttributes {
  @IsOptional()
  @IsString()
  @Length(1, 70, { message: "Title must be between 1 and 70 characters" })
  @ApiProperty({ required: false, description: "Impact story title (max 70 characters)", maxLength: 70 })
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(IMPACT_STORY_STATUSES)
  @ApiProperty({ enum: IMPACT_STORY_STATUSES, description: "Impact story status (required)" })
  status: ImpactStoryStatus;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: "Organization UUID (must exist in the database)" })
  organizationUuid?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, type: String, format: "date", description: "Impact story date" })
  date?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String, description: "Array of category strings" })
  category?: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String, description: "Impact story content (JSON string or text)" })
  content?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    type: String,
    description: "Legacy thumbnail field"
  })
  thumbnail?: string;
}

export class UpdateImpactStoryDataDto extends JsonApiDataDto({ type: "impactStories" }, StoreImpactStoryAttributes) {}

export class UpdateImpactStoryBody extends JsonApiBodyDto(UpdateImpactStoryDataDto) {}
