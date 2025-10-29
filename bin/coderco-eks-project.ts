#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClusterStack } from '../lib/eks-stack';
import { NetworkingStack } from '../lib/networking-stack';

const app = new cdk.App();

const networkingStack = new NetworkingStack(app, 'NetworkingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
    }
});

const eksStack= new ClusterStack(app, 'ClusterStack', {
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

eksStack.addDependency(networkingStack)


