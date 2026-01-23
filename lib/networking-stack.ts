import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      createInternetGateway: true,
      natGateways: 1,
      availabilityZones: ["us-east-1a", "us-east-1b"],
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    const securityGroup = new ec2.SecurityGroup(this, "mySecurityGroup", {
      vpc: this.vpc,
      securityGroupName: this.node.getContext("securityGroupName"),
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule (
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
    );

    securityGroup.addIngressRule (
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
    );
  }
}