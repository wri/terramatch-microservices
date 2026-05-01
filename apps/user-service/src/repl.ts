import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { bulkOrganisationImport } from "./repl/bulk-organisation-import";
import { bulkUserImport } from "./repl/bulk-user-import";

bootstrapRepl("User Service", AppModule, { bulkOrganisationImport, bulkUserImport });
