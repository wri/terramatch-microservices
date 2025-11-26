import { DocumentBuilder, JsonApiDocument, ResourceBuilder } from "./json-api-builder";
import { RequestContext } from "nestjs-request-context";
import { Permission } from "@terramatch-microservices/database/entities";

/**
 * A utility for unit tests that can take any likely response from a standard v3 controller and
 * produce a JsonApiDocument from it.
 */
export const serialize = (data: JsonApiDocument | DocumentBuilder | ResourceBuilder) => {
  if (data instanceof DocumentBuilder) return data.serialize();
  if (data instanceof ResourceBuilder) return data.document.serialize();
  return data;
};

/**
 * Mock the request context userId, which is relied on in many controllers and services
 */
export function mockUserId(userId?: number) {
  jest
    .spyOn(RequestContext, "currentContext", "get")
    .mockReturnValue({ req: { authenticatedUserId: userId }, res: {} });
}

/**
 * Mock the permissions returned from the `getUserPermissionNames` method on the Permission entity,
 * effectively setting the permissions for the currently logged in user.
 */
export function mockPermissions(...permissions: string[]) {
  Permission.getUserPermissionNames = jest.fn().mockResolvedValue(permissions);
}
