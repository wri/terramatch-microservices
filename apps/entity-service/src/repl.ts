import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import * as oneOff from "./repl/oneOff";
import { bulkWorkdayImport } from "./repl/bulk-workday-import";

// See comment in oneOff/index.ts for details on how to add new one-off scripts
bootstrapRepl("Entity Service", AppModule, { oneOff, bulkWorkdayImport });
