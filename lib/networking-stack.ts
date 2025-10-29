import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkingStack extends cdk.Stack {

  public readonly vpc: ec2.Vpc;
  public readonly vpcId: string;
  public readonly subnetPublicId: string;
  public readonly subnetPublicId2: string;
  public readonly subnetPrivateId: string;
  public readonly subnetPrivateId2: string

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

  const vpc = new ec2.Vpc(this, 'Vpc', {
    ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    createInternetGateway: true,
    natGateways: 1,
    availabilityZones: ["us-east-1a", "us-east-1b"],
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 24,
        name: 'private',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }
    ]
  });
  this.vpc = vpc;
  this.vpcId = vpc.vpcId;
  this.subnetPublicId = vpc.publicSubnets[0].subnetId,
  this.subnetPublicId2 = vpc.publicSubnets[1].subnetId,
  this.subnetPrivateId = vpc.privateSubnets[0].subnetId,
  this.subnetPrivateId2 = vpc.privateSubnets[1].subnetId
  
  const securityGroup = new ec2.SecurityGroup(this, "mySecurityGroup", {
    vpc,
    securityGroupName: "security-group-demo",
    allowAllOutbound: true,
  });

  securityGroup.addIngressRule(ec2.Peer.anyIpv4(),
    ec2.Port.tcp(80),
   );
  }
}