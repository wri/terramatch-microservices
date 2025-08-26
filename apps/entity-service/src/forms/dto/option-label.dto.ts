import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "optionLabels", id: "string" })
export class OptionLabelDto {
  @ApiProperty({ description: "Option label slug" })
  slug: string;

  @ApiProperty({ description: "Option label text in requesting user's locale, if available" })
  label: string;

  @ApiProperty({ description: "Option label text in English", nullable: true })
  imageUrl: string | null;
}
