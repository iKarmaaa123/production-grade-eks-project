import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from "aws-cdk-lib/aws-eks";

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
        // this is used to disable ssl redirection due to our ingress controller already doing this
        server: {
          extraArgs: ["--insecure"],
          service: {
            type: "ClusterIP"
          },
          ingress: {
            enabled: true,
            path: "/",
            controller: "aws",
            ingressClassName: "nginx",
            annotations: {
              "nginx.ingress.kubernetes.io/force-ssl-redirect": "false",
              "nginx.ingress.kubernetes.io/ssl-passthrough": "true ",
              "cert-manager.io/cluster-issuer": "issuer"
            },
            hostname: "argocd.cdk-labs.com",
            tls: true,
            extraTls: [{
                hosts: ["argocd.cdk-labs.com"],
                secretName: "argocd-tls"
              }]   
          }
        }
      }
    }).node.addDependency(ingressController)
  }
}