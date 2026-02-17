import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class UserAssociationDeleteQueryDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsUUID("4", { each: true })
  @ApiProperty({
    description: "The UUIDs of the users to delete",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"]
  })
  uuids: string[];
}
