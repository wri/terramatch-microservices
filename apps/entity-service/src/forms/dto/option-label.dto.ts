import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

@JsonApiDto({ type: "optionLabels", id: "string" })
export class OptionLabelDto {
  @IsString()
  @ApiProperty({ description: "Option label slug" })
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  altValue: string | null;

  @IsString()
  @ApiProperty({ description: "Option label text in requesting user's locale, if available" })
  label: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Option image", type: String, nullable: true, required: false })
  imageUrl?: string | null;
}
