import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as rds from 'aws-cdk-lib/aws-rds';
interface MonitoringStackProps extends cdk.StackProps {
  dbInstance: rds.IDatabaseInstance;
  ebEnvironment: elasticbeanstalk.CfnEnvironment;
}
export declare class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
export {};
//# sourceMappingURL=monitoring-stack.d.ts.map
