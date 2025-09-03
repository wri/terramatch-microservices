import { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { DocumentBuilder, ResourceBuilder } from "./json-api-builder";
import { map } from "rxjs";

export class DocumentBuilderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map(data => {
        if (data instanceof DocumentBuilder) return data.serialize();
        if (data instanceof ResourceBuilder) return data.document.serialize();
        return data;
      })
    );
  }
}
