import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { HelmConstruct } from "./modules/helm-construct";
import { ClusterStack } from "./eks-stack";
import { AppSettings } from "./config/app-settings";


export class HelmStack extends Stack {
  constructor(scope: Construct, id: string, eksStack: ClusterStack, props?: StackProps) {
    super(scope, id, props)

    const helm = new HelmConstruct(this, "HelmStack", {
      cluster: eksStack.cluster,
      certManagerServiceAccount: eksStack.certManagerServiceAccount,
      externalDNSServiceAccount: eksStack.externalDNSServiceAccount,
      installCRDs: AppSettings.INSTALL_CRDs
    })
  }
}