import * as cdk from 'aws-cdk-lib';
import { ClusterStack } from '../lib/eks-stack';
import { HelmStack } from '../lib/helm-stack';
import dotenv from "dotenv"


const app = new cdk.App();
const eksStack = new ClusterStack(app, "ClusterStack", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
  }});

const helmStack = new HelmStack(app, "HelmStack", eksStack, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
  }});
