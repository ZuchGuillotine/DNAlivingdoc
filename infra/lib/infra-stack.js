"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraStack = void 0;
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
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class InfraStack extends cdk.Stack {
    vpc;
    appSecurityGroup;
    dbInstance;
    dbSecret;
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create VPC with public and private subnets
        this.vpc = new ec2.Vpc(this, 'StackTrackerVPC', {
            vpcName: 'stacktracker-vpc',
            maxAzs: 2, // Use 2 AZs for high availability
            natGateways: 1, // Start with 1 NAT gateway to control costs
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 24,
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                }
            ],
            // Enable DNS hostnames and support
            enableDnsHostnames: true,
            enableDnsSupport: true,
        });
        // Create application security group
        this.appSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
            vpc: this.vpc,
            securityGroupName: 'stacktracker-app-sg',
            description: 'Security group for StackTracker application',
            allowAllOutbound: true, // Allow outbound traffic for application
        });
        // Create a security group for the RDS instance
        const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for StackTracker RDS instance',
            allowAllOutbound: false,
        });
        // Allow application to connect to database
        dbSecurityGroup.addIngressRule(this.appSecurityGroup, ec2.Port.tcp(5432), 'Allow application to connect to database');
        // Create a secret for the database credentials
        this.dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
            secretName: 'stacktracker/db-credentials',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'stacktracker_admin' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                passwordLength: 16,
            },
        });
        // Create parameter group for database with pgvector support
        const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_15_8,
            }),
            parameters: {
                'max_connections': '100',
            },
        });
        // Create the RDS instance
        this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_15_8,
            }),
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            securityGroups: [dbSecurityGroup],
            credentials: rds.Credentials.fromSecret(this.dbSecret),
            databaseName: 'stacktracker',
            backupRetention: cdk.Duration.days(7),
            preferredBackupWindow: '03:00-04:00',
            preferredMaintenanceWindow: 'Mon:04:00-Mon:05:00',
            parameterGroup: parameterGroup,
        });
        // Create Lambda execution role
        const lambdaExecutionRole = new iam.Role(this, 'PgVectorLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });
        // Grant Lambda access to Secrets Manager
        this.dbSecret.grantRead(lambdaExecutionRole);
        // Create Lambda function to install pgvector
        const pgvectorInstallerFunction = new lambda.Function(this, 'PgVectorInstallerFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            role: lambdaExecutionRole,
            code: lambda.Code.fromInline(`
        const { Client } = require('pg');
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          if (event.RequestType === 'Delete') {
            return {
              Status: 'SUCCESS',
              PhysicalResourceId: 'PgVectorInstaller',
              Data: {}
            };
          }
          
          try {
            const secretsManager = new SecretsManagerClient();
            const secret = await secretsManager.send(new GetSecretValueCommand({
              SecretId: process.env.SECRET_ARN
            }));
            const credentials = JSON.parse(secret.SecretString);
            
            const client = new Client({
              host: process.env.DB_ENDPOINT,
              port: parseInt(process.env.DB_PORT),
              database: 'stacktracker',
              user: credentials.username,
              password: credentials.password,
              ssl: { rejectUnauthorized: false }
            });
            
            await client.connect();
            console.log('Connected to database');
            
            // Install pgvector extension
            await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
            console.log('pgvector extension installed successfully');
            
            await client.end();
            
            return {
              Status: 'SUCCESS',
              PhysicalResourceId: 'PgVectorInstaller',
              Data: {}
            };
          } catch (error) {
            console.error('Error installing pgvector:', error);
            return {
              Status: 'FAILED',
              PhysicalResourceId: 'PgVectorInstaller',
              Reason: error.message
            };
          }
        };
      `),
            timeout: cdk.Duration.minutes(5),
            vpc: this.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [this.appSecurityGroup],
            environment: {
                DB_ENDPOINT: this.dbInstance.dbInstanceEndpointAddress,
                DB_PORT: this.dbInstance.dbInstanceEndpointPort,
                SECRET_ARN: this.dbSecret.secretArn,
            },
        });
        // Create custom resource to trigger Lambda function
        const pgvectorInstaller = new cdk.CustomResource(this, 'PgVectorInstaller', {
            serviceToken: pgvectorInstallerFunction.functionArn,
        });
        // Add dependency to ensure database is created before installing pgvector
        pgvectorInstaller.node.addDependency(this.dbInstance);
        // Add VPC endpoints for AWS services to reduce NAT Gateway costs
        this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        });
        this.vpc.addInterfaceEndpoint('RDSEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.RDS,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        });
        this.vpc.addGatewayEndpoint('S3Endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
        });
        // Create S3 bucket for uploads
        const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                    allowedOrigins: ['*'], // Configure this properly for production
                    allowedHeaders: ['*'],
                },
            ],
        });
        // Output VPC information
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
            exportName: 'StackTrackerVpcIdV2',
        });
        new cdk.CfnOutput(this, 'PrivateSubnetIds', {
            value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
            description: 'Private Subnet IDs',
            exportName: 'StackTrackerPrivateSubnetIdsV2',
        });
        new cdk.CfnOutput(this, 'PublicSubnetIds', {
            value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
            description: 'Public Subnet IDs',
            exportName: 'StackTrackerPublicSubnetIdsV2',
        });
        // Output database information
        new cdk.CfnOutput(this, 'DatabaseEndpoint', {
            value: this.dbInstance.dbInstanceEndpointAddress,
            description: 'Database endpoint',
            exportName: 'StackTrackerDatabaseEndpointV2',
        });
        new cdk.CfnOutput(this, 'DatabasePort', {
            value: this.dbInstance.dbInstanceEndpointPort,
            description: 'Database port',
            exportName: 'StackTrackerDatabasePortV2',
        });
        new cdk.CfnOutput(this, 'DatabaseSecretArn', {
            value: this.dbSecret.secretArn,
            description: 'Database secret ARN',
            exportName: 'StackTrackerDatabaseSecretArnV2',
        });
        // Output S3 bucket information
        new cdk.CfnOutput(this, 'UploadsBucketName', {
            value: uploadsBucket.bucketName,
            description: 'S3 bucket for uploads',
            exportName: 'StackTrackerUploadsBucketNameV2',
        });
        new cdk.CfnOutput(this, 'UploadsBucketArn', {
            value: uploadsBucket.bucketArn,
            description: 'S3 bucket ARN for uploads',
            exportName: 'StackTrackerUploadsBucketArnV2',
        });
    }
}
exports.InfraStack = InfraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsaURBQW1DO0FBRW5DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsdURBQXlDO0FBQ3pDLCtFQUFpRTtBQUVqRSwrREFBaUQ7QUFDakQseURBQTJDO0FBRTNDLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLEdBQUcsQ0FBVTtJQUNiLGdCQUFnQixDQUFvQjtJQUNwQyxVQUFVLENBQXVCO0lBQ2pDLFFBQVEsQ0FBd0I7SUFFaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzlDLE9BQU8sRUFBRSxrQkFBa0I7WUFDM0IsTUFBTSxFQUFFLENBQUMsRUFBRSxrQ0FBa0M7WUFDN0MsV0FBVyxFQUFFLENBQUMsRUFBRSw0Q0FBNEM7WUFDNUQsbUJBQW1CLEVBQUU7Z0JBQ25CO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxRQUFRO29CQUNkLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07aUJBQ2xDO2dCQUNEO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxTQUFTO29CQUNmLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtpQkFDL0M7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFB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Q0FnUkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAgICAqIEBkZXNjcmlwdGlvbiAgICAgIDogXG4gICAgKiBAYXV0aG9yICAgICAgICAgICA6IFxuICAgICogQGdyb3VwICAgICAgICAgICAgOiBcbiAgICAqIEBjcmVhdGVkICAgICAgICAgIDogMjYvMDUvMjAyNSAtIDE0OjM2OjU1XG4gICAgKiBcbiAgICAqIE1PRElGSUNBVElPTiBMT0dcbiAgICAqIC0gVmVyc2lvbiAgICAgICAgIDogMS4wLjBcbiAgICAqIC0gRGF0ZSAgICAgICAgICAgIDogMjYvMDUvMjAyNVxuICAgICogLSBBdXRob3IgICAgICAgICAgOiBcbiAgICAqIC0gTW9kaWZpY2F0aW9uICAgIDogXG4qKi9cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgZWxhc3RpY2JlYW5zdGFsayBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2JlYW5zdGFsayc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5cbmV4cG9ydCBjbGFzcyBJbmZyYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHZwYzogZWMyLlZwYztcbiAgcHVibGljIHJlYWRvbmx5IGFwcFNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBwdWJsaWMgcmVhZG9ubHkgZGJJbnN0YW5jZTogcmRzLkRhdGFiYXNlSW5zdGFuY2U7XG4gIHB1YmxpYyByZWFkb25seSBkYlNlY3JldDogc2VjcmV0c21hbmFnZXIuU2VjcmV0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBWUEMgd2l0aCBwdWJsaWMgYW5kIHByaXZhdGUgc3VibmV0c1xuICAgIHRoaXMudnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1N0YWNrVHJhY2tlclZQQycsIHtcbiAgICAgIHZwY05hbWU6ICdzdGFja3RyYWNrZXItdnBjJyxcbiAgICAgIG1heEF6czogMiwgLy8gVXNlIDIgQVpzIGZvciBoaWdoIGF2YWlsYWJpbGl0eVxuICAgICAgbmF0R2F0ZXdheXM6IDEsIC8vIFN0YXJ0IHdpdGggMSBOQVQgZ2F0ZXdheSB0byBjb250cm9sIGNvc3RzXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdQcml2YXRlJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdJc29sYXRlZCcsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIC8vIEVuYWJsZSBETlMgaG9zdG5hbWVzIGFuZCBzdXBwb3J0XG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGFwcGxpY2F0aW9uIHNlY3VyaXR5IGdyb3VwXG4gICAgdGhpcy5hcHBTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdBcHBsaWNhdGlvblNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdzdGFja3RyYWNrZXItYXBwLXNnJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIFN0YWNrVHJhY2tlciBhcHBsaWNhdGlvbicsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLCAvLyBBbGxvdyBvdXRib3VuZCB0cmFmZmljIGZvciBhcHBsaWNhdGlvblxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGEgc2VjdXJpdHkgZ3JvdXAgZm9yIHRoZSBSRFMgaW5zdGFuY2VcbiAgICBjb25zdCBkYlNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0RhdGFiYXNlU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBTdGFja1RyYWNrZXIgUkRTIGluc3RhbmNlJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgYXBwbGljYXRpb24gdG8gY29ubmVjdCB0byBkYXRhYmFzZVxuICAgIGRiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIHRoaXMuYXBwU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgICdBbGxvdyBhcHBsaWNhdGlvbiB0byBjb25uZWN0IHRvIGRhdGFiYXNlJ1xuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgYSBzZWNyZXQgZm9yIHRoZSBkYXRhYmFzZSBjcmVkZW50aWFsc1xuICAgIHRoaXMuZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdEYXRhYmFzZVNlY3JldCcsIHtcbiAgICAgIHNlY3JldE5hbWU6ICdzdGFja3RyYWNrZXIvZGItY3JlZGVudGlhbHMnLFxuICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHsgdXNlcm5hbWU6ICdzdGFja3RyYWNrZXJfYWRtaW4nIH0pLFxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcbiAgICAgICAgZXhjbHVkZVB1bmN0dWF0aW9uOiB0cnVlLFxuICAgICAgICBwYXNzd29yZExlbmd0aDogMTYsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHBhcmFtZXRlciBncm91cCBmb3IgZGF0YWJhc2Ugd2l0aCBwZ3ZlY3RvciBzdXBwb3J0XG4gICAgY29uc3QgcGFyYW1ldGVyR3JvdXAgPSBuZXcgcmRzLlBhcmFtZXRlckdyb3VwKHRoaXMsICdEYXRhYmFzZVBhcmFtZXRlckdyb3VwJywge1xuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VJbnN0YW5jZUVuZ2luZS5wb3N0Z3Jlcyh7XG4gICAgICAgIHZlcnNpb246IHJkcy5Qb3N0Z3Jlc0VuZ2luZVZlcnNpb24uVkVSXzE1XzgsXG4gICAgICB9KSxcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21heF9jb25uZWN0aW9ucyc6ICcxMDAnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgUkRTIGluc3RhbmNlXG4gICAgdGhpcy5kYkluc3RhbmNlID0gbmV3IHJkcy5EYXRhYmFzZUluc3RhbmNlKHRoaXMsICdEYXRhYmFzZScsIHtcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlSW5zdGFuY2VFbmdpbmUucG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNV84LFxuICAgICAgfSksXG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgfSxcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UMywgZWMyLkluc3RhbmNlU2l6ZS5NSUNSTyksXG4gICAgICBhbGxvY2F0ZWRTdG9yYWdlOiAyMCxcbiAgICAgIG1heEFsbG9jYXRlZFN0b3JhZ2U6IDEwMCxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbZGJTZWN1cml0eUdyb3VwXSxcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbVNlY3JldCh0aGlzLmRiU2VjcmV0KSxcbiAgICAgIGRhdGFiYXNlTmFtZTogJ3N0YWNrdHJhY2tlcicsXG4gICAgICBiYWNrdXBSZXRlbnRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgcHJlZmVycmVkQmFja3VwV2luZG93OiAnMDM6MDAtMDQ6MDAnLFxuICAgICAgcHJlZmVycmVkTWFpbnRlbmFuY2VXaW5kb3c6ICdNb246MDQ6MDAtTW9uOjA1OjAwJyxcbiAgICAgIHBhcmFtZXRlckdyb3VwOiBwYXJhbWV0ZXJHcm91cCxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZXhlY3V0aW9uIHJvbGVcbiAgICBjb25zdCBsYW1iZGFFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdQZ1ZlY3RvckxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgTGFtYmRhIGFjY2VzcyB0byBTZWNyZXRzIE1hbmFnZXJcbiAgICB0aGlzLmRiU2VjcmV0LmdyYW50UmVhZChsYW1iZGFFeGVjdXRpb25Sb2xlKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gdG8gaW5zdGFsbCBwZ3ZlY3RvclxuICAgIGNvbnN0IHBndmVjdG9ySW5zdGFsbGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQZ1ZlY3Rvckluc3RhbGxlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgQ2xpZW50IH0gPSByZXF1aXJlKCdwZycpO1xuICAgICAgICBjb25zdCB7IFNlY3JldHNNYW5hZ2VyQ2xpZW50LCBHZXRTZWNyZXRWYWx1ZUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1zZWNyZXRzLW1hbmFnZXInKTtcbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChldmVudC5SZXF1ZXN0VHlwZSA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIFN0YXR1czogJ1NVQ0NFU1MnLFxuICAgICAgICAgICAgICBQaHlzaWNhbFJlc291cmNlSWQ6ICdQZ1ZlY3Rvckluc3RhbGxlcicsXG4gICAgICAgICAgICAgIERhdGE6IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc2VjcmV0c01hbmFnZXIgPSBuZXcgU2VjcmV0c01hbmFnZXJDbGllbnQoKTtcbiAgICAgICAgICAgIGNvbnN0IHNlY3JldCA9IGF3YWl0IHNlY3JldHNNYW5hZ2VyLnNlbmQobmV3IEdldFNlY3JldFZhbHVlQ29tbWFuZCh7XG4gICAgICAgICAgICAgIFNlY3JldElkOiBwcm9jZXNzLmVudi5TRUNSRVRfQVJOXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBjb25zdCBjcmVkZW50aWFscyA9IEpTT04ucGFyc2Uoc2VjcmV0LlNlY3JldFN0cmluZyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgICAgICAgICAgICBob3N0OiBwcm9jZXNzLmVudi5EQl9FTkRQT0lOVCxcbiAgICAgICAgICAgICAgcG9ydDogcGFyc2VJbnQocHJvY2Vzcy5lbnYuREJfUE9SVCksXG4gICAgICAgICAgICAgIGRhdGFiYXNlOiAnc3RhY2t0cmFja2VyJyxcbiAgICAgICAgICAgICAgdXNlcjogY3JlZGVudGlhbHMudXNlcm5hbWUsXG4gICAgICAgICAgICAgIHBhc3N3b3JkOiBjcmVkZW50aWFscy5wYXNzd29yZCxcbiAgICAgICAgICAgICAgc3NsOiB7IHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGNsaWVudC5jb25uZWN0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ29ubmVjdGVkIHRvIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEluc3RhbGwgcGd2ZWN0b3IgZXh0ZW5zaW9uXG4gICAgICAgICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0NSRUFURSBFWFRFTlNJT04gSUYgTk9UIEVYSVNUUyB2ZWN0b3I7Jyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncGd2ZWN0b3IgZXh0ZW5zaW9uIGluc3RhbGxlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2xpZW50LmVuZCgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBTdGF0dXM6ICdTVUNDRVNTJyxcbiAgICAgICAgICAgICAgUGh5c2ljYWxSZXNvdXJjZUlkOiAnUGdWZWN0b3JJbnN0YWxsZXInLFxuICAgICAgICAgICAgICBEYXRhOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgaW5zdGFsbGluZyBwZ3ZlY3RvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBTdGF0dXM6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICBQaHlzaWNhbFJlc291cmNlSWQ6ICdQZ1ZlY3Rvckluc3RhbGxlcicsXG4gICAgICAgICAgICAgIFJlYXNvbjogZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFt0aGlzLmFwcFNlY3VyaXR5R3JvdXBdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgREJfRU5EUE9JTlQ6IHRoaXMuZGJJbnN0YW5jZS5kYkluc3RhbmNlRW5kcG9pbnRBZGRyZXNzLFxuICAgICAgICBEQl9QT1JUOiB0aGlzLmRiSW5zdGFuY2UuZGJJbnN0YW5jZUVuZHBvaW50UG9ydCxcbiAgICAgICAgU0VDUkVUX0FSTjogdGhpcy5kYlNlY3JldC5zZWNyZXRBcm4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSByZXNvdXJjZSB0byB0cmlnZ2VyIExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IHBndmVjdG9ySW5zdGFsbGVyID0gbmV3IGNkay5DdXN0b21SZXNvdXJjZSh0aGlzLCAnUGdWZWN0b3JJbnN0YWxsZXInLCB7XG4gICAgICBzZXJ2aWNlVG9rZW46IHBndmVjdG9ySW5zdGFsbGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgZGVwZW5kZW5jeSB0byBlbnN1cmUgZGF0YWJhc2UgaXMgY3JlYXRlZCBiZWZvcmUgaW5zdGFsbGluZyBwZ3ZlY3RvclxuICAgIHBndmVjdG9ySW5zdGFsbGVyLm5vZGUuYWRkRGVwZW5kZW5jeSh0aGlzLmRiSW5zdGFuY2UpO1xuXG4gICAgLy8gQWRkIFZQQyBlbmRwb2ludHMgZm9yIEFXUyBzZXJ2aWNlcyB0byByZWR1Y2UgTkFUIEdhdGV3YXkgY29zdHNcbiAgICB0aGlzLnZwYy5hZGRJbnRlcmZhY2VFbmRwb2ludCgnU2VjcmV0c01hbmFnZXJFbmRwb2ludCcsIHtcbiAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgc3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnZwYy5hZGRJbnRlcmZhY2VFbmRwb2ludCgnUkRTRW5kcG9pbnQnLCB7XG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlJEUyxcbiAgICAgIHN1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy52cGMuYWRkR2F0ZXdheUVuZHBvaW50KCdTM0VuZHBvaW50Jywge1xuICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuUzMsXG4gICAgICBzdWJuZXRzOiBbeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIGJ1Y2tldCBmb3IgdXBsb2Fkc1xuICAgIGNvbnN0IHVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVcGxvYWRzQnVja2V0Jywge1xuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QT1NULCBzMy5IdHRwTWV0aG9kcy5QVVRdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSwgLy8gQ29uZmlndXJlIHRoaXMgcHJvcGVybHkgZm9yIHByb2R1Y3Rpb25cbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IFZQQyBpbmZvcm1hdGlvblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVlBDIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdTdGFja1RyYWNrZXJWcGNJZFYyJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcml2YXRlU3VibmV0SWRzJywge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnByaXZhdGVTdWJuZXRzLm1hcChzdWJuZXQgPT4gc3VibmV0LnN1Ym5ldElkKS5qb2luKCcsJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaXZhdGUgU3VibmV0IElEcycsXG4gICAgICBleHBvcnROYW1lOiAnU3RhY2tUcmFja2VyUHJpdmF0ZVN1Ym5ldElkc1YyJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQdWJsaWNTdWJuZXRJZHMnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMucHVibGljU3VibmV0cy5tYXAoc3VibmV0ID0+IHN1Ym5ldC5zdWJuZXRJZCkuam9pbignLCcpLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaWMgU3VibmV0IElEcycsXG4gICAgICBleHBvcnROYW1lOiAnU3RhY2tUcmFja2VyUHVibGljU3VibmV0SWRzVjInLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IGRhdGFiYXNlIGluZm9ybWF0aW9uXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYkluc3RhbmNlLmRiSW5zdGFuY2VFbmRwb2ludEFkZHJlc3MsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RhdGFiYXNlIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6ICdTdGFja1RyYWNrZXJEYXRhYmFzZUVuZHBvaW50VjInLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlUG9ydCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRiSW5zdGFuY2UuZGJJbnN0YW5jZUVuZHBvaW50UG9ydCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGF0YWJhc2UgcG9ydCcsXG4gICAgICBleHBvcnROYW1lOiAnU3RhY2tUcmFja2VyRGF0YWJhc2VQb3J0VjInLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdEYXRhYmFzZSBzZWNyZXQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdTdGFja1RyYWNrZXJEYXRhYmFzZVNlY3JldEFyblYyJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBTMyBidWNrZXQgaW5mb3JtYXRpb25cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXBsb2Fkc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIHVwbG9hZHMnLFxuICAgICAgZXhwb3J0TmFtZTogJ1N0YWNrVHJhY2tlclVwbG9hZHNCdWNrZXROYW1lVjInLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VwbG9hZHNCdWNrZXRBcm4nLCB7XG4gICAgICB2YWx1ZTogdXBsb2Fkc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBBUk4gZm9yIHVwbG9hZHMnLFxuICAgICAgZXhwb3J0TmFtZTogJ1N0YWNrVHJhY2tlclVwbG9hZHNCdWNrZXRBcm5WMicsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==