import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export class UserServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = process.env.TM_ENV;
    if (env == null) throw new Error('No TM_ENV defined');

    const imageTag = process.env.IMAGE_TAG;
    if (imageTag == null) throw new Error('No IMAGE_TAG defined');

    const envName = env[0].toUpperCase() + env.substring(1);

    // Identify the most recently updated user service docker image
    const repository = ecr.Repository.fromRepositoryName(
      this,
      `Terramatch Microservices ${envName}`,
      `terramatch-microservices/user-service-${env}`
    );
    const image = ecs.ContainerImage.fromEcrRepository(repository, imageTag);

    // Identify our pre-configured cluster.
    const vpc = ec2.Vpc.fromLookup(this, 'wri-terramatch-vpc', {
      vpcId: 'vpc-0beac5973796d96b1',
    });
    const cluster = ecs.Cluster.fromClusterAttributes(
      this,
      'terramatch-microservices',
      {
        clusterName: 'terramatch-microservices',
        clusterArn:
          'arn:aws:ecs:eu-west-1:603634817705:cluster/terramatch-microservices',
        vpc,
      }
    );
    // Create a load-balanced Fargate service and make it public
    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `terramatch-user-service-${env}`,
      {
        cluster: cluster,
        cpu: 512,
        desiredCount: 1,
        taskImageOptions: {
          image,
          family: `terramatch-user-service-${env}`,
          containerName: `terramatch-user-service-${env}`,
          logDriver: ecs.LogDriver.awsLogs({
            logGroup: LogGroup.fromLogGroupName(this, 'user-service-test', 'ecs/user-service-test'),
            streamPrefix: 'user-service-test'
          })
        },
        memoryLimitMiB: 2048,
        assignPublicIp: false,
        publicLoadBalancer: false,
        loadBalancerName: `user-service-${env}`,
      }
    );
    // Without a valid healthcheck endpoint, the deploy stalls out, unable to verify that it has
    // started up successfully.
    service.targetGroup.configureHealthCheck({
      path: '/health',
    });

    // This seems like the sort of things we should be able to specify in the config above, but
    // I haven't found a way. For some reason, the default port mapping created above doesn't specify
    // the appProtocol, so we need to remove the one that was created and add our own.
    service.taskDefinition.defaultContainer?.portMappings.pop();
    service.taskDefinition.defaultContainer?.addPortMappings({
      name: `terramatch-user-service-${env}-80-tcp`,
      containerPort: 80,
      hostPort: 80,
      protocol: ecs.Protocol.TCP,
      appProtocol: ecs.AppProtocol.http,
    });
  }
}
