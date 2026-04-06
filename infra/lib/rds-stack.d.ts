import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export declare class RdsStack extends cdk.Stack {
  readonly dbInstance: rds.DatabaseInstance;
  readonly dbSecret: secretsmanager.Secret;
  constructor(scope: Construct, id: string, vpc: ec2.IVpc, props?: cdk.StackProps);
}
//# sourceMappingURL=rds-stack.d.ts.map
