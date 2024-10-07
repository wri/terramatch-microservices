/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsoleLogger } from '@nestjs/common';

const IS_PROD = process.env['NODE_ENV'] === 'production';
const IS_TEST = process.env['NODE_ENV'] === 'test';

export class TMLogService extends ConsoleLogger {
  override log(message: any, ...optionalParams: [...any, string?, string?]) {
    if (!IS_PROD && !IS_TEST) super.log(message, ...optionalParams);
  }

  override error(message: any, ...optionalParams: [...any, string?, string?]) {
    if (!IS_TEST) super.error(message, ...optionalParams);
  }

  override warn(message: any, ...optionalParams: [...any, string?, string?]) {
    if (!IS_TEST) super.warn(message, ...optionalParams);
  }

  override debug(message: any, ...optionalParams: [...any, string?, string?]) {
    if (!IS_PROD && !IS_TEST) super.debug(message, ...optionalParams);
  }

  override verbose(message: any, ...optionalParams: [...any, string?, string?]) {
    if (!IS_PROD && !IS_TEST) super.verbose(message, ...optionalParams);
  }
}