import { Stack, StackProps } from 'aws-cdk-lib';
import { ClusterConstruct } from './modules/eks-construct';
import { VpcConstruct } from './modules/vpc-construct';
import { IamConstruct } from './modules/iam-construct';
import { Construct } from 'constructs';
import { AppSettings } from './config/app-settings';
import * as eks from 'aws-cdk-lib/aws-eks';
import { SubnetType, IpAddresses } from "aws-cdk-lib/aws-ec2";
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import { AppConstants } from './config/app-constants';

export class ClusterStack extends Stack {
  public readonly cluster: eks.Cluster
  public readonly certManagerServiceAccount: eks.ServiceAccount
  public readonly externalDNSServiceAccount: eks.ServiceAccount

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new VpcConstruct(this, "VpcConstruct", {
      ipAddresses: IpAddresses.cidr(`${AppConstants.CIDR_RANGE}`),
      createInternetGateway: AppSettings.CREATE_INTERNET_GATEWAY,
      natGateways: AppSettings.NAT_GATEWAY,
      availabilityZones: AppSettings.AVAILABILITY_ZONES,
      cidrMask: AppSettings.CIDR_MASK,
      publicSubnetName: AppSettings.PUBLIC_SUBNET_NAME,
      publicSubnetType: SubnetType.PUBLIC,
      privateSubnetName: AppSettings.PRIVATE_SUBNET_NAME,
      privateSubnetType: SubnetType.PRIVATE_WITH_EGRESS,
      securityGroupName: AppSettings.SECURITY_GROUP_NAME,
      allowAllOutbound: AppSettings.ALLOW_ALL_OUTBOUND,
    });

     const iam = new IamConstruct(this, "IamConstruct", {
       nodeGroupRoleName: AppConstants.EKS_NODE_GROUP_ROLE_NAME,
    });

    const eksCluster = new ClusterConstruct(this, "ClusterConstruct", {
      clusterName: AppSettings.CLUSTER_NAME,
      vpc: vpc.vpc,
      outputConfigCommand: AppSettings.OUTPUT_CONFIG_COMMAND,
      version: eks.KubernetesVersion.V1_32,
      endpointAccess: eks.EndpointAccess.PUBLIC,
      publicSubnet: SubnetType.PUBLIC,
      privateSubnet: SubnetType.PRIVATE_WITH_EGRESS,
      kubectlLayer:  new KubectlV32Layer(this, "kubectl"),
      authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
      defaultCapacity: AppSettings.DEFAULT_CAPACITY,
      desiredSize: AppSettings.DESIRED_SIZE,
      minSize: AppSettings.MIN_SIZE,
      maxSize: AppSettings.MAX_SIZE,
      nodeGroupRole: iam.eksClusterNodeGroupRole,
      route53Policy: iam.route53Policy,
    });

    this.cluster = eksCluster.cluster;
    this.certManagerServiceAccount = eksCluster.certManagerServiceAccount;
    this.externalDNSServiceAccount = eksCluster.externalDNSServiceAccount;
  }
}