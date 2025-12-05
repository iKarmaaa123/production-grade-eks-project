#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClusterStack } from '../lib/eks-stack';
import { NetworkingStack } from '../lib/networking-stack';
import { HelmStack } from "../lib/helm-stack"

const app = new cdk.App();

const networkingStack = new NetworkingStack(app, 'NetworkingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

const clusterStack = new ClusterStack(app, 'ClusterStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  vpc: networkingStack.vpc,
  publicSubnetId: networkingStack.subnetPublicId,
  publicSubnetId2: networkingStack.subnetPublicId2,
  privateSubnetId: networkingStack.subnetPrivateId,
  privateSubnetId2: networkingStack.subnetPrivateId2,
});

const helmStack = new HelmStack(app, "HelmStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  cluster: clusterStack.cluster,
  certManagerServiceAccount: clusterStack.certManagerServiceAccount,
  externalDNSServiceAccount: clusterStack.externalDNSServiceAccount
})

clusterStack.addDependency(networkingStack);


