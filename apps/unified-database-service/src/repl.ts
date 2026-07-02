import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { AIRTABLE_ENTITIES } from "./airtable/airtable.processor";

bootstrapRepl("Unified Database Service", AppModule, { AIRTABLE_ENTITIES });
