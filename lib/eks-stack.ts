import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import * as Route53 from 'aws-cdk-lib/aws-route53';

interface EKSClusterStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  publicSubnetId: string;
  publicSubnetId2: string;
  privateSubnetId: string;
  privateSubnetId2: string;
}

export class ClusterStack extends cdk.Stack {

  public readonly cluster: cdk.aws_eks.Cluster
  public readonly certManagerServiceAccount: cdk.aws_eks.ServiceAccount
  public readonly externalDNSServiceAccount: cdk.aws_eks.ServiceAccount

  constructor(scope: Construct, id: string, props: EKSClusterStackProps) {
    super(scope, id, props);

    const accountId = this.account;

    const kubernetesApiAccessPolicy = new iam.PolicyStatement({
      actions: [
        "eks:AccessKubernetesApi",
        "eks:DescribeCluster",
      ],
      resources: [
        `arn:aws:eks:*:${accountId}:cluster/*`
      ]
    });

    // const NodeInstanceRolePolicyStatement = new iam.PolicyStatement({
    //   actions: [
    //     "ecr:BatchCheckLayerAvailability",
    //     "ecr:BatchGetImage",
    //     "ecr:GetDownloadUrlForLayer",
    //     "ecr:GetAuthorizationToken"
    //   ],
    //   resources: [
    //     `arn:aws:eks:*:${accountId}:cluster/*`
    //   ]
    // })

    const EKSClusterMasterRole = new iam.Role(this, "ClusterMasterRole", {
      assumedBy: new iam.AccountPrincipal(accountId),
      roleName: "EksClusterMasterRole",
      inlinePolicies: {
        "KubernetesApiAccess": new iam.PolicyDocument({
          statements: [kubernetesApiAccessPolicy]
        })
      }
    });

    // const NodeInstanceRole = new iam.Role(this, "NodeInstanceRole", {
    //   assumedBy: new iam.ServicePrincipal("eks.amazonaws.com"),
    //   roleName: "NodeInstanceRole",
    //   inlinePolicies: {
    //     "NodeInstanceRolePolicy": new iam.PolicyDocument({
    //       statements: [NodeInstanceRolePolicyStatement]
    //     })
    //   }
    // })

    this.cluster = new eks.Cluster(this, "HelloEKS", {
      vpc: props.vpc,
      clusterName: "demo-cluster",
      mastersRole: EKSClusterMasterRole,
      // role: NodeInstanceRole,
      version: eks.KubernetesVersion.V1_32,
      endpointAccess: eks.EndpointAccess.PUBLIC_AND_PRIVATE.onlyFrom("0.0.0.0/0"),
      vpcSubnets: [
        { subnetType: ec2.SubnetType.PUBLIC },
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
      ],
      defaultCapacity: 2,
      kubectlLayer: new KubectlV32Layer(this, "kubectl"),
    });

    const certManagerNamespace = this.cluster.addManifest("cert-manager", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "cert-manager" }
    });

    const externalDNSNamespace = this.cluster.addManifest("external-dns", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "external-dns" }
    });

    const zone = Route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: "cdk-labs.com"
    });

    this.certManagerServiceAccount = this.cluster.addServiceAccount("cert-manager", {
      name: "cert-manager",
      namespace: "cert-manager",
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
      name: "external-dns",
      namespace: "external-dns",
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

    this.certManagerServiceAccount.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        "route53:GetChange",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:ListHostedZonesByName",
        "route53:ListHostedZones"
      ],
      resources: ["*"],
    }));

    this.externalDNSServiceAccount.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        "route53:GetChange",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:ListHostedZonesByName",
        "route53:ListHostedZones"
      ],
      resources: ["*"],
    }));
  }
}