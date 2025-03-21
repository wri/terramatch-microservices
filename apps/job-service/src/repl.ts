import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { repl } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const logger = new TMLogger("REPL");

async function bootstrap() {
  const replServer = await repl(AppModule);

  const cacheDirectory = join("node_modules", ".cache");

  if (!existsSync(cacheDirectory)) mkdirSync(cacheDirectory);

  replServer.setupHistory(join(cacheDirectory, ".nestjs_repl_history"), error => {
    if (error) logger.error(error);
  });
}
bootstrap();
