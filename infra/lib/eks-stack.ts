import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import * as Route53 from 'aws-cdk-lib/aws-route53'

interface eksStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

//hello world!!!!
export class ClusterStack extends cdk.Stack {
  public readonly cluster: eks.Cluster
  public readonly certManagerServiceAccount: eks.ServiceAccount
  public readonly externalDNSServiceAccount: eks.ServiceAccount

  constructor(scope: Construct, id: string, props: eksStackProps) {
    super(scope, id, props);

    const mastersRole = new iam.Role(this, "ClusterMasterRole", {
      assumedBy: new iam.AccountPrincipal(cdk.Stack.of(this).account),
    });

    this.cluster = new eks.Cluster(this, "HelloEKS", {
      clusterName: this.node.getContext("clusterName"),
      vpc: props.vpc,
      mastersRole: mastersRole,
      version: eks.KubernetesVersion.V1_32,
      endpointAccess: eks.EndpointAccess.PUBLIC,
      vpcSubnets: [
        { subnetType: ec2.SubnetType.PUBLIC },
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
      ],
      defaultCapacity: 0,
      kubectlLayer: new KubectlV32Layer(this, "kubectl"),
    });

    this.cluster.addNodegroupCapacity("ASG", {
      desiredSize: 2,
      minSize: 1,
      maxSize: 4
    })

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
      domainName: this.node.getContext("domainName")
    });

    this.certManagerServiceAccount = this.cluster.addServiceAccount("cert-manager", {
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

    const route53Policy = new iam.PolicyStatement({
      actions: [
        "route53:GetChange",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:ListHostedZonesByName",
        "route53:ListHostedZones"
      ],
      resources: [zone.hostedZoneArn],
    });

    this.certManagerServiceAccount.role.addToPrincipalPolicy(route53Policy)
    this.externalDNSServiceAccount.role.addToPrincipalPolicy(route53Policy)
  }
}