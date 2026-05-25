import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { AppConstants } from "../config/app-constants";
import { ManagedPolicy, ServicePrincipal, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

export interface IamConstructProps {
  nodeGroupRoleName?: string;
}

export class IamConstruct extends Construct {
  public readonly route53Policy: PolicyStatement;
  public readonly eksClusterNodeGroupRole: Role;
  public readonly iamUserArn: string;

  constructor(scope: Construct, id: string, props: IamConstructProps) {
    super(scope, id)

    this.iamUserArn = `arn:aws:iam::${cdk.Stack.of(this).account}:user/${AppConstants.IAM_PROJECT_USER}`

    this.eksClusterNodeGroupRole = new Role(this, "eksClusterNodeGroupRole", {
      roleName: props.nodeGroupRoleName,
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSWorkerNodePolicy"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy")
      ]
    });

    this.route53Policy = new PolicyStatement({
      actions: [
        "route53:GetChange",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:ListHostedZonesByName",
        "route53:ListHostedZones"
        ],
        resources: ["*"],
    });
    }
}