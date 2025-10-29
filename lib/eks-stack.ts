import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import * as Route53 from 'aws-cdk-lib/aws-route53';

interface EKSClusterStackProps extends cdk.StackProps {
    vpc: ec2.IVpc
    publicSubnetId: string
    publicSubnetId2: string
    privateSubnetId: string
    privateSubnetId2: string
}

const clusterName = "demo-cluster"
const version = eks.KubernetesVersion.V1_32
const endpointAccess = eks.EndpointAccess.PUBLIC_AND_PRIVATE.onlyFrom("0.0.0.0/0")
const defaultCapacity = 2

export class ClusterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EKSClusterStackProps) {
    super(scope, id, props);

const accountId = this.account

const kubernetesApiAccessPolicy = new iam.PolicyStatement({
  actions: [
    "eks:AccessKubernetesApi",
    "eks:DescribeCluster"
  ],
  resources: [
    `arn:aws:eks:*:${accountId}:cluster/*`
  ]
    })

const EKSClusterMasterRole = new iam.Role(this, "ClusterMasterRole", {
  assumedBy: new iam.AccountPrincipal(accountId),
  roleName: "EksClusterMasterRole",
  inlinePolicies: {
    "KubernetesApiAccess": new iam.PolicyDocument({
      statements: [kubernetesApiAccessPolicy]
    })
  }
})

const cluster = new eks.Cluster(this, "HelloEKS", {
  vpc: props.vpc,
  clusterName: clusterName,
  mastersRole: EKSClusterMasterRole,
  version: version,
  endpointAccess: endpointAccess,
  vpcSubnets: [{ subnetType: ec2.SubnetType.PUBLIC },
               { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}],
  defaultCapacity: defaultCapacity,
  kubectlLayer: new KubectlV32Layer(this, 'kubectl'),
});

const certManagerNameSpace = cluster.addManifest("cert-manager", {
  apiVersion: "v1",
  kind: "Namespace",
  metadata: {name: "cert-manager"}
})

const externalDNSNameSpace = cluster.addManifest("external-dns", {
  apiVersion: "v1",
  kind: "Namespace",
  metadata: {name: "external-dns"}
})

const zone = Route53.HostedZone.fromLookup(this, "HostedZone", {
  domainName: "cdk-labs.com"
})

const certManagerServiceAccount = cluster.addServiceAccount("cert-manager", {
  name: "cert-manager",
  namespace: "cert-manager",
  identityType: eks.IdentityType.IRSA,
})

const externalDNSManagerServiceAccount = cluster.addServiceAccount("external-dns", {
  name: "external-dns",
  namespace: "external-dns",
  identityType: eks.IdentityType.IRSA,
})

certManagerServiceAccount.role.addToPrincipalPolicy(new iam.PolicyStatement({
  actions: [
    "route53:GetChange",
    "route53:ChangeResourceRecordSets",
    "route53:ListResourceRecordSets",
    "route53:ListHostedZonesByName",
    "route53:ListHostedZones"
],  
  resources: [ zone.hostedZoneArn ],
}));

externalDNSManagerServiceAccount.role.addToPrincipalPolicy(new iam.PolicyStatement({
  actions: [
    "route53:GetChange",
    "route53:ChangeResourceRecordSets",
    "route53:ListResourceRecordSets",
    "route53:ListHostedZonesByName",
    "route53:ListHostedZones"
],
  resources: [ zone.hostedZoneArn ],
}));

// cluster.addHelmChart('MyAppChart', {
//   chart: 'nginx',
//   repository: 'https://charts.bitnami.com/bitnami',
//   release: "nginx",
//   namespace: 'nginx',
//   createNamespace: true,
//   wait: true,
//   values: {
//     installCRDs: true
//   },
// })

// cluster.addHelmChart("cert-manager", {
//   chart: "cert-manager",
//   repository: "https://charts.jetstack.io",
//   release: "cert-manager",
//   namespace: "cert-manager",
//   createNamespace: false,
//   wait: true,
//   values: {
//     installCRDs: true,
//     "serviceAccount.annotations.eks.amazonaws.com/role-arn": certManagerServiceAccount.role.roleArn,
//     "ingressShim.defaultIssuerKind": "dns01",
//     "ingressShim.defaultIssuerProvider": "route53",
//     "extraArgs": ["--dns01-recursive-nameservers=8.8.8.8:53","--dns01-recursive-nameservers-only"],
//     "domainFilters": ["cdk-labs.com"]
//   },
// }).node.addDependency(certManagerNameSpace)

// cluster.addHelmChart("external-dns", {
//   repository: "https://charts.bitnami.com/bitnami",
//   release: "external-dns",
//   chart: "external-dns",
//   namespace: "external-dns",
//   createNamespace: false,
//   wait: true,
//   values: {
//     installCRDs: true,
//     "serviceAccount.annotations.eks.amazonaws.com/role-arn": externalDNSManagerServiceAccount.role.roleArn,
//     "env": ["name": "AWS_DEFAULT_REGION", "value": "us-east-1"]
//   }
// }).node.addDependency(externalDNSNameSpace)
 }
}