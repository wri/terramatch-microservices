import { ArgumentsHost, Catch } from "@nestjs/common";
import { TMLogger } from "./tm-logger";
import { StateMachineException } from "@terramatch-microservices/database/util/model-column-state-machine";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";

@Catch()
export class TMGlobalFilter extends SentryGlobalFilter {
  private readonly logger = new TMLogger("ExceptionLogger");

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof StateMachineException) {
      this.logger.error(`Encountered State Machine error: [${exception.message}]`, exception.stack);
    }

    super.catch(exception, host);
  }
}
