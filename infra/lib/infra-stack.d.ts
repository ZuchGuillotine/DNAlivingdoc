/**
 * @description      :
 * @author           :
 * @group            :
 * @created          : 26/05/2025 - 14:36:55
 *
 * MODIFICATION LOG
 * - Version         : 1.0.0
 * - Date            : 26/05/2025
 * - Author          :
 * - Modification    :
 **/
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
export declare class InfraStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly appSecurityGroup: ec2.SecurityGroup;
  readonly dbInstance: rds.IDatabaseInstance;
  readonly dbSecret: secretsmanager.ISecret;
  readonly ebApplication: elasticbeanstalk.CfnApplication;
  readonly ebEnvironment: elasticbeanstalk.CfnEnvironment;
  constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
//# sourceMappingURL=infra-stack.d.ts.map
