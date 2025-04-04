import { FactoryGirl } from "factory-girl-ts";
import { ProjectPitch } from "../entities";

export const ProjectPitchFactory = FactoryGirl.define(ProjectPitch, async () => ({
  uuid: crypto.randomUUID()
}));
