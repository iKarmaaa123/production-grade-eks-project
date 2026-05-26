import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Role, PolicyStatement, IRole } from "aws-cdk-lib/aws-iam";
import * as Route53 from 'aws-cdk-lib/aws-route53';
import { AppConstants } from '../config/app-constants';

export interface EksStackProps {
  clusterName?: string;
  vpc?: ec2.IVpc;
  outputConfigCommand?: boolean;
  version: cdk.aws_eks.KubernetesVersion;
  endpointAccess?: cdk.aws_eks.EndpointAccess;
  publicSubnet?: cdk.aws_ec2.SubnetType;
  privateSubnet?: cdk.aws_ec2.SubnetType;
  defaultCapacity?: number;
  kubectlLayer: cdk.aws_lambda.ILayerVersion;
  authenticationMode?: cdk.aws_eks.AuthenticationMode;
  desiredSize?: number;
  minSize?: number;
  maxSize?: number;
  nodeGroupRole?: Role;
  route53Policy: PolicyStatement;
}

export class ClusterConstruct extends Construct {
  public readonly cluster: eks.Cluster
  public readonly certManagerServiceAccount: eks.ServiceAccount
  public readonly externalDNSServiceAccount: eks.ServiceAccount

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id);

    this.cluster = new eks.Cluster(this, "HelloEKS", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      outputConfigCommand: props.outputConfigCommand,
      version: props.version,
      endpointAccess: props.endpointAccess,
      vpcSubnets: [
        { subnetType: props.privateSubnet }
      ],
      defaultCapacity: props.defaultCapacity,
      kubectlLayer: props.kubectlLayer,
      authenticationMode: props.authenticationMode
    })

    this.cluster.addNodegroupCapacity("ASG", {
      desiredSize: props.desiredSize,
      minSize: props.minSize,
      maxSize: props.maxSize,
      nodeRole: props.nodeGroupRole
    })

    this.cluster.grantAccess("adminClusterAccess", AppConstants.IAM_USER_PROJECT_ARN, [
      eks.AccessPolicy.fromAccessPolicyName("AmazonEKSClusterAdminPolicy", {
        accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER,
      })
    ])

    this.cluster.grantAccess("adminClusterAccessForGitHubActionsRunner", AppConstants.GITHUB_ACTIONS_OIDC_ROLE_ARN, [
    eks.AccessPolicy.fromAccessPolicyName("AmazonEKSClusterAdminPolicy", {
      accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER,
      })
    ])

    const certManagerNamespace = this.cluster.addManifest("cert-manager", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: AppConstants.CERT_MANAGER_NAMESPACE }
    });

    const externalDNSNamespace = this.cluster.addManifest("external-dns", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: AppConstants.EXTERNAL_DNS_NAMESPACE }
    });

    const zone = Route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: AppConstants.DOMAIN_NAME
    });

    this.certManagerServiceAccount = this.cluster.addServiceAccount("cert-manager", {
      namespace: AppConstants.CERT_MANAGER_NAMESPACE,
      identityType: eks.IdentityType.IRSA,
      labels: {
        "app.kubernetes.io/managed-by": "Helm"
      },
      annotations: {
        "meta.helm.sh/release-name": "cert-manager",
        "meta.helm.sh/release-namespace": "cert-manager"
      }
    });
    this.certManagerServiceAccount.node.addDependency(certManagerNamespace);

    this.externalDNSServiceAccount = this.cluster.addServiceAccount("external-dns", {
      namespace: AppConstants.EXTERNAL_DNS_NAMESPACE,
      identityType: eks.IdentityType.IRSA,
      labels: {
        "app.kubernetes.io/managed-by": "Helm"
      },
      annotations: {
        "meta.helm.sh/release-name": "external-dns",
        "meta.helm.sh/release-namespace": "external-dns"
      }
    });
    this.externalDNSServiceAccount.node.addDependency(externalDNSNamespace);

    this.certManagerServiceAccount.role.addToPrincipalPolicy(props.route53Policy)
    this.externalDNSServiceAccount.role.addToPrincipalPolicy(props.route53Policy)
  }
}