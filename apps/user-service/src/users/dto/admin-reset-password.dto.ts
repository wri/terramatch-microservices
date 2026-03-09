import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

/**
 * V2-compatible admin reset password body. Password must be at least 10 characters
 * with mixed case and at least one number.
 */
export class AdminResetPasswordDto {
  @ApiProperty({ minLength: 10, example: "NewSecureP4ss" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/(?=.*[a-z])/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/(?=.*[A-Z])/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/(?=.*\d)/, { message: "Password must contain at least one number" })
  password: string;
}
