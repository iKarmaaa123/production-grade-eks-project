import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from "aws-cdk-lib/aws-eks"

interface HelmStackProps extends cdk.StackProps {
    cluster: cdk.aws_eks.Cluster
    certManagerServiceAccount: cdk.aws_eks.ServiceAccount
    externalDNSServiceAccount: cdk.aws_eks.ServiceAccount
}

export class HelmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HelmStackProps) {
    super(scope, id, props);

  new eks.HelmChart(this, "nginx", {
    cluster: props.cluster,
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
      "serviceAccount.create": false,
      "serviceAccount.name": props.externalDNSServiceAccount.serviceAccountName,
      "serviceAccount": {
        "annotations": {
          "eks.amazonaws.com/role-arn": props.externalDNSServiceAccount.role.roleArn
        }
      },
      env: [{
        name: "AWS_DEFAULT_REGION",
        value: "us-east-1"
      }]
    }
  })

  new eks.HelmChart(this, "argocd", {
    cluster: props.cluster,
    chart: "argo-cd",
    repository: "https://argoproj.github.io/argo-helm",
    release: "argocd",
    version: "9.1.3",
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
          ingressClassName: "nginx",
          annotations: {
            "nginx.ingress.kubernetes.io/force-ssl-redirect": "false",
            "cert-manager.io/cluster-issuer": "issuer"
          },
          hosts: ["argocd.cdk-labs.com"],
          tls: [{
            secretName: "argocd-ingress-tls",
            hosts: ["argocd.cdk-labs.com"]
          }]
        }
      }
    }
  })
 }
}