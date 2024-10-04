const IS_PROD = process.env['NODE_ENV'] === 'production';
const IS_TEST = process.env['NODE_ENV'] === 'test';

// TODO: Add Sentry support
export default class Log {
  static debug(message: any, ...optionalParams: any[]) {
    if (!IS_PROD && !IS_TEST) console.debug(message, ...optionalParams);
  }

  static info(message: any, ...optionalParams: any[]) {
    if (!IS_PROD && !IS_TEST) console.info(message, ...optionalParams);
  }

  static warn(message: any, ...optionalParams: any[]) {
    if (!IS_TEST) console.warn(message, ...optionalParams);
  }

  static error(message: any, ...optionalParams: any[]) {
    if (!IS_TEST) console.error(message, ...optionalParams);
  }
}
