#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/service-stack";
import { upperFirst, camelCase } from "lodash";

const app = new cdk.App();
const id = `${upperFirst(camelCase(process.env.TM_SERVICE))}Stack-${process.env.TM_ENV}`;
new ServiceStack(app, id, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
