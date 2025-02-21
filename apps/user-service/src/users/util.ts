import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { User } from "@terramatch-microservices/database/entities";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";

export async function addUserResource(document: DocumentBuilder, user: User) {
  const userResource = document.addData(user.uuid, new UserDto(user, await user.myFrameworks()));

  const org = await user.primaryOrganisation();
  if (org != null) {
    const orgResource = document.addIncluded(org.uuid, new OrganisationDto(org));
    const userStatus = org.OrganisationUser?.status ?? "na";
    userResource.relateTo("org", orgResource, { userStatus });
  }

  return document;
}
