import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from "aws-cdk-lib/aws-eks";
import { hostname } from 'os';

interface HelmStackProps extends cdk.StackProps {
  cluster: eks.Cluster;
  certManagerServiceAccount: eks.ServiceAccount;
  externalDNSServiceAccount: eks.ServiceAccount;
}

export class HelmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HelmStackProps) {
    super(scope, id);
 
   const ingressControllerHelmChart = new eks.HelmChart(this, "nginx", {
      cluster: props.cluster,
      chart: "nginx-ingress",
      repository: "https://kubernetes.github.io/ingress-nginx",
      release: "nginx-ingress",
      namespace: "nginx",
      version: "v1.14.1",
      createNamespace: true,
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
        domainFilters: ["cdk-labs.com"],
        provider: {
          name: "aws"
      },
        serviceAccount: {
          create: false,
          name: props.externalDNSServiceAccount.serviceAccountName,
        },
        env: [
          {
            name: "AWS_DEFAULT_REGION",
            value: cdk.Stack.of(this).region
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
            hostname: `argocd.${this.node.tryGetContext("domainName")}`,
            tls: true,
          }
        }
      }
    }).node.addDependency(ingressControllerHelmChart)

    new eks.HelmChart(this, "prometheus", {
      cluster: props.cluster,
      chart: "kube-prometheus-stack",
      repository: "https://prometheus-community.github.io/helm-charts",
      release: "prometheus",
      version: "80.13.3",
      createNamespace: true,
      namespace: "prometheus",
      wait: true,
      values: {
        enabled: true,
        grafana: {
          ingress: {
            enabled: true,
            ingressClassName: "nginx",
            annotations: {
              "cert-manager.io/cluster-issuer": "issuer",
            },
            tls: [{
              secretName: "prometheus-server-tls",
              hosts: [`grafana.${this.node.tryGetContext("Name")}`]
            }],
          hosts: [`grafana.${this.node.tryGetContext("Name")}`]
          },
        }
      }
    })
  }
}