import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcConstructProps {
  ipAddresses?:  cdk.aws_ec2.IIpAddresses;
  createInternetGateway?: boolean;
  natGateways?: number;
  availabilityZones?: string[];
  cidrMask?: number;
  publicSubnetName: string;
  privateSubnetName: string;
  publicSubnetType: cdk.aws_ec2.SubnetType;
  privateSubnetType: cdk.aws_ec2.SubnetType;
  securityGroupName?: string;
  allowAllOutbound?: boolean;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipAddresses: props.ipAddresses,
      createInternetGateway: props.createInternetGateway,
      natGateways: props.natGateways,
      availabilityZones: props.availabilityZones,
      subnetConfiguration: [
        {
          cidrMask: props.cidrMask,
          name: props.publicSubnetName,
          subnetType: props.publicSubnetType,
        },
        {
          cidrMask: props.cidrMask,
          name: props.privateSubnetName,
          subnetType: props.privateSubnetType,
        }
      ]
    });

    const securityGroup = new ec2.SecurityGroup(this, "mySecurityGroup", {
      vpc: this.vpc,
      securityGroupName: props.securityGroupName,
      allowAllOutbound: props.allowAllOutbound,
    });

    securityGroup.addIngressRule (ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    securityGroup.addIngressRule (ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
  }
}