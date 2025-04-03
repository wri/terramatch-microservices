import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { EntityQueryDto } from "./entities/dto/entity-query.dto";

bootstrapRepl("Entity Service", AppModule, {
  EntityQueryDto
});
