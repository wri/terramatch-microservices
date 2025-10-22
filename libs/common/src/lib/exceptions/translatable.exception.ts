import { HttpException, HttpStatus } from "@nestjs/common";
import { Dictionary } from "lodash";

export class TranslatableException extends HttpException {
  constructor(message = "Bad Request", code = "", variables: Dictionary<unknown> = {}) {
    super(
      HttpException.createBody({
        message,
        statusCode: HttpStatus.BAD_REQUEST,
        code,
        variables
      }),
      HttpStatus.BAD_REQUEST
    );
  }
}
