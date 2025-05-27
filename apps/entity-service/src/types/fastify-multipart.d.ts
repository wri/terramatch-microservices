import "fastify";
import { MultipartFile, MultipartFields } from "@fastify/multipart";

declare module "fastify" {
  interface FastifyRequest {
    parts: () => AsyncIterableIterator<MultipartFile>;
  }

  interface MultipartFile {
    file: NodeJS.ReadableStream;
    toBuffer: () => Promise<Buffer>;
    fieldname: string;
    filename: string;
    encoding: string;
    mimetype: string;
    fields: MultipartFields;
  }

  export interface MultipartValue<T = unknown> {
    file: unknown;
    type: "field";
    value: T;
    fieldname: string;
    mimetype: string;
    encoding: string;
    fieldnameTruncated: boolean;
    valueTruncated: boolean;
    fields: MultipartFields;
  }

  export type Part = MultipartFile | MultipartValue;
}
