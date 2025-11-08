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
  kubectlLayer: new KubectlV32Layer(this, "kubectl"),
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
  labels: {
    "app.kubernetes.io/managed-by": "Helm"
  },
  annotations: {
    "meta.helm.sh/release-name": "cert-manager",
    "meta.helm.sh/release-namespace": "cert-manager"
  }
})
certManagerServiceAccount.node.addDependency(certManagerNameSpace)

const externalDNSManagerServiceAccount = cluster.addServiceAccount("external-dns", {
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
})
externalDNSManagerServiceAccount.node.addDependency(externalDNSNameSpace)

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

cluster.addHelmChart("nginx", {
  chart: "ingress-nginx",
  repository: "https://kubernetes.github.io/ingress-nginx",
  release: "ingress-nginx",
  namespace: "nginx",
  version: "4.13.3",
  createNamespace: true,
  wait: true,
  values: {
    installCRDs: true
  },
})

cluster.addHelmChart("cert-manager", {
  chart: "cert-manager",
  repository: "https://charts.jetstack.io",
  release: "cert-manager",
  namespace: "cert-manager",
  version: "1.13.2",
  createNamespace: false,
  wait: true,
  values: {
    installCRDs: true,
    "serviceAccount.create": false,
    "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn": certManagerServiceAccount.role.roleArn,
    "serviceAccount.name": certManagerServiceAccount.serviceAccountName,
    "ingressShim.defaultIssuerKind": "dns01",
    "ingressShim.defaultIssuerProvider": "route53",
    "extraArgs[0]": "--dns01-recursive-nameservers=8.8.8.8:53",
    "extraArgs[1]": "--dns01-recursive-nameservers-only",
    domainFilters: ["cdk-labs.com"],
    region: "us-east-1"
  }
}).node.addDependency(certManagerNameSpace)

cluster.addHelmChart("external-dns", {
  chart: "external-dns",
  repository: "https://kubernetes-sigs.github.io/external-dns/",
  release: "external-dns",
  namespace: "external-dns",
  version: "1.19.0",
  createNamespace: false,
  wait: true,
  values: {
    installCRDs: true,
    "serviceAccount.create": false,
    "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn": externalDNSManagerServiceAccount.role.roleArn,
    "serviceAccount.name": externalDNSManagerServiceAccount.serviceAccountName,
    env: [{
      name: "AWS_DEFAULT_REGION",
      value: "us-east-1"
    }]
  }
}).node.addDependency(externalDNSNameSpace)
 }
}