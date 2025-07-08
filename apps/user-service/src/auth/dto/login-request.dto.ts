import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class LoginAttributes {
  @IsEmail()
  @ApiProperty()
  emailAddress: string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;
}

export class LoginBody extends JsonApiBodyDto(class LoginData extends CreateDataDto("logins", LoginAttributes) {}) {}
