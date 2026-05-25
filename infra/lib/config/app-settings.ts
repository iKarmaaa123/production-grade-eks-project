export class AppSettings {
  static readonly CLUSTER_NAME = 'eks-project-cluster';
  static readonly SECURITY_GROUP_NAME = 'eks-project-security-group';
  static readonly GRAFANA_SECRET_NAME = 'grafana-server-tls';
  static readonly PROMETHEUS_SECRET_NAME = 'prometheus-server-tls';
  static readonly PUBLIC_SUBNET_NAME = "public"
  static readonly CIDR_MASK = 24
  static readonly DEFAULT_CAPACITY = 0
  static readonly DESIRED_SIZE = 2
  static readonly MIN_SIZE = 1
  static readonly MAX_SIZE = 4
  static readonly AVAILABILITY_ZONES = ["us-east-1a", "us-east-1b"]
  static readonly NAT_GATEWAY = 1
  static readonly CREATE_INTERNET_GATEWAY = true
  static readonly ALLOW_ALL_OUTBOUND = true
  static readonly OUTPUT_CONFIG_COMMAND = true
  static readonly INSTALL_CRDs = true
}