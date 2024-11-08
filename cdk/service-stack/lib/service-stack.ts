import { Stack, StackProps, Tags } from "aws-cdk-lib";
import { PrivateSubnet, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Cluster, ContainerImage, LogDriver } from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps
} from "aws-cdk-lib/aws-ecs-patterns";
import { Role } from "aws-cdk-lib/aws-iam";
import { upperFirst } from "lodash";

const extractFromEnv = (...names: string[]) =>
  names.map(name => {
    const value = process.env[name];
    if (value == null) throw new Error(`No ${name} defined`);
    return value;
  });

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

const customizeFargate = (service: string, env: string, props: Mutable<ApplicationLoadBalancedFargateServiceProps>) => {
  if (service === "research-service") {
    props.cpu = 1024;
  }

  return props;
};

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const [env, service, imageTag] = extractFromEnv("TM_ENV", "TM_SERVICE", "IMAGE_TAG");
    const envName = upperFirst(env);

    // Identify the most recently updated service docker image
    const repository = Repository.fromRepositoryName(
      this,
      `Terramatch Microservices ${envName}`,
      `terramatch-microservices/${service}-${env}`
    );
    const image = ContainerImage.fromEcrRepository(repository, imageTag);

    // Identify our pre-configured cluster.
    const vpc = Vpc.fromLookup(this, "wri-terramatch-vpc", {
      vpcId: "vpc-0beac5973796d96b1"
    });
    const cluster = Cluster.fromClusterAttributes(this, "terramatch-microservices", {
      clusterName: "terramatch-microservices",
      clusterArn: "arn:aws:ecs:eu-west-1:603634817705:cluster/terramatch-microservices",
      vpc
    });

    const securityGroups = [
      SecurityGroup.fromLookupByName(this, "default", "default", vpc),
      SecurityGroup.fromLookupByName(this, `db-${env}`, `db-${env}`, vpc)
    ];
    const privateSubnets = [
      PrivateSubnet.fromPrivateSubnetAttributes(this, "eu-west-1a", {
        subnetId: "subnet-065992a829eb772a3",
        routeTableId: "rtb-07f85b7827c451bc9"
      }),
      PrivateSubnet.fromPrivateSubnetAttributes(this, "eu-west-1b", {
        subnetId: "subnet-0f48d0681051fa49a",
        routeTableId: "rtb-06afefb0f592f11d6"
      })
    ];

    // Create a load-balanced Fargate service and make it public
    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      `terramatch-${service}-${env}`,
      customizeFargate(service, env, {
        serviceName: `terramatch-${service}-${env}`,
        cluster,
        cpu: 512,
        desiredCount: 1,
        taskImageOptions: {
          image,
          family: `terramatch-${service}-${env}`,
          containerName: `terramatch-${service}-${env}`,
          logDriver: LogDriver.awsLogs({
            logGroup: LogGroup.fromLogGroupName(this, `${service}-${env}`, `ecs/${service}-${env}`),
            streamPrefix: `${service}-${env}`
          }),
          executionRole: Role.fromRoleName(this, "ecsTaskExecutionRole", "ecsTaskExecutionRole")
        },
        securityGroups: securityGroups,
        taskSubnets: { subnets: privateSubnets },
        memoryLimitMiB: 2048,
        assignPublicIp: false,
        publicLoadBalancer: false,
        loadBalancerName: `${service}-${env}`
      })
    );
    fargateService.targetGroup.configureHealthCheck({
      path: "/health"
    });
    Tags.of(fargateService.loadBalancer).add("service", `${service}-${env}`);
  }
}
