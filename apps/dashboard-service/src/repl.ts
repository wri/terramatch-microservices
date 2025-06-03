import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";

bootstrapRepl("Dashboard Service", AppModule);
