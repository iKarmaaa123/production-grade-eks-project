import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Cluster, ServiceAccount, HelmChart } from "aws-cdk-lib/aws-eks";
import { AppSettings } from '../config/app-settings';
import { AppConstants } from '../config/app-constants';

export interface HelmStackProps {
  cluster: Cluster;
  certManagerServiceAccount: ServiceAccount;
  externalDNSServiceAccount: ServiceAccount;
  installCRDs?: boolean;
}

export class HelmConstruct extends Construct {
  constructor(scope: Construct, id: string, props: HelmStackProps) {
    super(scope, id);
 
   const ingressControllerHelmChart = new HelmChart(this, "nginx", {
     cluster: props.cluster,
     chart: "ingress-nginx",
     repository: "https://kubernetes.github.io/ingress-nginx",
     release: "ingress-nginx",
     namespace: "nginx",
     createNamespace: true,
     wait: true,
     values: {
       installCRDs: props.installCRDs
     },
   });

   new HelmChart(this, "cert-manager", {
     cluster: props.cluster,
     chart: "cert-manager",
     repository: "https://charts.jetstack.io",
     release: "cert-manager",
     namespace: "cert-manager",
     version: "1.19.2",
     createNamespace: false,
     wait: true,
     values: {
       installCRDs: props.installCRDs,
       serviceAccount: {
         create: false,
         name: props.certManagerServiceAccount.serviceAccountName,
       },
       ingressShim: {
         defaultIssuerKind: AppConstants.DEFAULT_ISSUES_KIND,
         defaultIssuerName: AppConstants.DEFAULT_ISSUES_NAME
       },
       dns01RecursiveNameservers: AppConstants.DNS_01_RECURSIVE_NAMESERVICE,
       dns01RecursiveNameserversOnly: true
     }
   });

    new HelmChart(this, "external-dns", {
      cluster: props.cluster,
      chart: "external-dns",
      repository: "https://kubernetes-sigs.github.io/external-dns/",
      release: "external-dns",
      namespace: "external-dns",
      version: "1.19.0",
      createNamespace: false,
      wait: true,
      values: {
        domainFilters: [AppConstants.DOMAIN_NAME],
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

    new HelmChart(this, "argocd", {
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
            hostname: `argocd.${AppConstants.DOMAIN_NAME}`,
            tls: true,
          }
        }
      }
    }).node.addDependency(ingressControllerHelmChart)

    new HelmChart(this, "prometheus", {
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
        prometheus: {
          ingress: {
            enabled: true,
            ingressClassName: "nginx",
            annotations: {
              "cert-manager.io/cluster-issuer": "issuer",
            },
            hosts: [`prometheus.${AppConstants.DOMAIN_NAME}`],
            tls: [{
              secretName: AppSettings.PROMETHEUS_SECRET_NAME,
              hosts: [`prometheus.${AppConstants.DOMAIN_NAME}`]
            }]
          }
        }, 
        grafana: {
          ingress: {
            enabled: true,
            ingressClassName: "nginx",
            annotations: {
              "cert-manager.io/cluster-issuer": "issuer",
            },
            hosts: [`grafana.${AppConstants.DOMAIN_NAME}`],
            tls: [{
              secretName: AppSettings.GRAFANA_SECRET_NAME,
              hosts: [`grafana.${AppConstants.DOMAIN_NAME}`]
            }],
          },
        }
      }
    })
  }
}