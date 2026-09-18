import { IEntryNestModule, NestFactory } from "@nestjs/core";
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Server } from "node:http";
import { TMLogger } from "./tm-logger";
import * as express from "express";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilderInterceptor } from "./document-builder-interceptor";

type HotData = {
  closePromise?: Promise<void>;
};
export type HMRModule = NodeJS.Module & {
  hot?: {
    accept(): void;
    dispose(callback: (data: HotData) => void): void;
    addStatusHandler(callback: () => void): void;
    data?: HotData;
  };
};

type ServiceOptions = {
  module: IEntryNestModule;
  swaggerConfig: Omit<OpenAPIObject, "paths">;
  devPort: number | string;

  // If your service has additional things to configure on the built app, use this method to do so.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalConfiguration?: (app: NestExpressApplication<Server<any, any>>) => void | Promise<void>;
};

const bootstrapService = (module: HMRModule, options: ServiceOptions) => {
  return async () => {
    if (module.hot?.data?.closePromise != null) {
      // wait for the previous application instance to fully shut down
      await module.hot.data.closePromise;
    }

    const app = await NestFactory.create<NestExpressApplication>(options.module, {
      forceCloseConnections: module.hot != null,
      logger: new TMLogger()
    });

    app.set("query parser", "extended");
    app.use(express.json({ limit: "5mb" }));

    if (process.env.NODE_ENV === "development") {
      // CORS is handled by the Api Gateway in AWS
      app.enableCors();
    }

    const document = SwaggerModule.createDocument(app, options.swaggerConfig);
    const swaggerPath = `${options.swaggerConfig.tags?.[0]?.name}/documentation/api`;
    SwaggerModule.setup(swaggerPath, app, document);

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true }
      })
    );

    app.useGlobalInterceptors(new DocumentBuilderInterceptor());

    if (options.additionalConfiguration != null) await options.additionalConfiguration(app);

    const port = process.env.NODE_ENV === "production" ? 80 : options.devPort;
    await app.listen(port);

    if (module.hot != null) {
      module.hot.accept();
      module.hot.dispose(data => {
        data.closePromise = app.close();
      });
    }

    Logger.log(`${options.swaggerConfig.info.title} is running on: http://localhost:${port}`);
  };
};

export default bootstrapService;
