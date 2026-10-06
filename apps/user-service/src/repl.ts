import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import * as oneOff from "./repl/oneOff";
import { bulkOrganisationImport } from "./repl/bulk-organisation-import";
import { bulkUserImport } from "./repl/bulk-user-import";

// See comment in oneOff/index.ts for details on how to add new one-off scripts
bootstrapRepl("User Service", AppModule, { oneOff, bulkOrganisationImport, bulkUserImport });
