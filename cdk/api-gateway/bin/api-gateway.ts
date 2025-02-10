#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiGatewayStack } from "../lib/api-gateway-stack";

const app = new cdk.App();
new ApiGatewayStack(app, `ApiGatewayStack-${process.env.TM_ENV ?? "local"}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
