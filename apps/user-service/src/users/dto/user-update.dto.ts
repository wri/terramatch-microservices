import { Equals, IsEnum, IsUUID, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

const VALID_LOCALES = ["en-US", "es-MX", "fr-FR", "pt-BR"];

class UserUpdateAttributes {
  @IsEnum(VALID_LOCALES)
  @ApiProperty({ description: "New default locale for the given user", nullable: true, enum: VALID_LOCALES })
  locale?: string | null;
}

class UserUpdate {
  @Equals("users")
  @ApiProperty({ enum: ["users"] })
  type: string;

  @IsUUID()
  @ApiProperty({ format: "uuid" })
  id: string;

  @ValidateNested()
  @Type(() => UserUpdateAttributes)
  @ApiProperty({ type: () => UserUpdateAttributes })
  attributes: UserUpdateAttributes;
}

export class UserUpdateBodyDto {
  @ValidateNested()
  @Type(() => UserUpdate)
  @ApiProperty({ type: () => UserUpdate })
  data: UserUpdate;
}
