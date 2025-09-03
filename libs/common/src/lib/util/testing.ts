import { DocumentBuilder, JsonApiDocument, ResourceBuilder } from "./json-api-builder";

// A utility for unit tests that can take any likely response from a standard v3 controller and
// product a JsonApiDocument from it.
export const serialize = (data: JsonApiDocument | DocumentBuilder | ResourceBuilder) => {
  if (data instanceof DocumentBuilder) return data.serialize();
  if (data instanceof ResourceBuilder) return data.document.serialize();
  return data;
};
