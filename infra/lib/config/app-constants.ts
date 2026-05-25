export class AppConstants {
  static readonly DOMAIN_NAME = 'cdk-labs.com';
  static readonly CIDR_RANGE = "10.0.0.0/16"
  static readonly IAM_PROJECT_USER = 'project';
  static readonly EKS_NODE_GROUP_ROLE_NAME = 'eksClusterNodeGroupRole';
  static readonly CERT_MANAGER_NAMESPACE = 'cert-manager';
  static readonly EXTERNAL_DNS_NAMESPACE = 'external-dns';
  static readonly DEFAULT_ISSUES_KIND = "ClusterIssuer"
  static readonly DEFAULT_ISSUES_NAME = "issuer";
  static readonly DNS_01_RECURSIVE_NAMESERVICE = "8.8.8.8:53"
}
