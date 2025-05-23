import "fastify";
import { MultipartFile, MultipartFields } from "@fastify/multipart";

declare module "fastify" {
  interface FastifyRequest {
    parts: () => AsyncIterableIterator<MultipartFile>;
  }

  interface MultipartFile {
    file: NodeJS.ReadableStream;
    fieldname: string;
    filename: string;
    encoding: string;
    mimetype: string;
    fields: MultipartFields;
  }
}
