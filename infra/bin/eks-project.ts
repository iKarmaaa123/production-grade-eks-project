import * as cdk from 'aws-cdk-lib';
import { ClusterStack } from '../lib/eks-stack';
import { HelmStack } from '../lib/helm-stack';

const app = new cdk.App();
const eksStack = new ClusterStack(app, "ClusterStack");
const helmStack = new HelmStack(app, "HelmStack", eksStack);
