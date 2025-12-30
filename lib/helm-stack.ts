import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from "aws-cdk-lib/aws-eks";
import { Certificate } from 'crypto';

interface HelmStackProps extends cdk.StackProps {
  cluster: cdk.aws_eks.Cluster;
  certManagerServiceAccount: cdk.aws_eks.ServiceAccount;
  externalDNSServiceAccount: cdk.aws_eks.ServiceAccount;
}

export class HelmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HelmStackProps) {
    super(scope, id, props);
 
   const ingressController = new eks.HelmChart(this, "nginx", {
      cluster: props.cluster,
      chart: "nginx-ingress",
      repository: "https://helm.nginx.com/stable",
      release: "nginx-ingress",
      namespace: "nginx",
      wait: true,
      values: {
        installCRDs: true
      },
    });

    new eks.HelmChart(this, "cert-manager", {
          cluster: props.cluster,
          chart: "cert-manager",
          repository: "https://charts.jetstack.io",
          release: "cert-manager",
          namespace: "cert-manager",
          version: "1.19.2",
          createNamespace: false,
          wait: true,
          values: {
            installCRDs: true,
            serviceAccount: {
              create: false,
              name: props.certManagerServiceAccount.serviceAccountName,
              annotations: {
                "eks.amazonaws.com/role-arn": props.certManagerServiceAccount.role.roleArn
              }
            },
            ingressShim: {
              defaultIssuerKind: "ClusterIssuer",
              defaultIssuerName: "issuer"
            },
            dns01RecursiveNameservers: "8.8.8.8:53",
            dns01RecursiveNameserversOnly: true
          }
        });

    new eks.HelmChart(this, "external-dns", {
      cluster: props.cluster,
      chart: "external-dns",
      repository: "https://kubernetes-sigs.github.io/external-dns/",
      release: "external-dns",
      namespace: "external-dns",
      version: "1.19.0",
      createNamespace: false,
      wait: true,
      values: {
        installCRDs: true,
        domainFilters: ["cdk-labs.com"],
        provider: {
          name: "aws"
      },
        serviceAccount: {
          create: false,
          name: props.externalDNSServiceAccount.serviceAccountName,
          annotations: {
            "eks.amazonaws.com/role-arn": props.externalDNSServiceAccount.role.roleArn
          }
        },
        env: [
          {
            name: "AWS_DEFAULT_REGION",
            value: "us-east-1"
          }
        ]
      }
    });

    new eks.HelmChart(this, "argocd", {
      cluster: props.cluster,
      chart: "argo-cd",
      repository: "https://argoproj.github.io/argo-helm",
      release: "argocd",
      version: "9.1.7",
      createNamespace: true,
      namespace: "argocd",
      wait: true,
      values: {
        installCRDs: true,
        server: {
          extraArgs: ["--insecure"],
          service: {
            type: "ClusterIP"
          },
          ingress: {
            enabled: true,
            ingressClassName: "nginx",
            annotations: {
              "cert-manager.io/cluster-issuer": "issuer",
            },
            hostname: "argocd.cdk-labs.com",
            tls: true,
          }
        }
      }
    }).node.addDependency(ingressController)
  }
}