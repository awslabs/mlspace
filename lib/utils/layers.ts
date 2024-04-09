/**
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as path from 'path';
import { existsSync, mkdirSync, rmdirSync, cpSync } from 'fs';
import { Architecture, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { BundlingOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LAMBDA_ARCHITECTURE, LAMBDA_RUNTIME } from '../constants';

const WORKING_DIR = process.cwd();

/**
 * Properties for LambdaLayer Construct
 *
 * @property {string} layerName - The name for the existing layer archive or to use when building
 * @property {string} description - The Description for the LayerVersion
 * @property {{[key: string]: string}?} environment - A key value map of variables to pass to the docker container
 * @property {string?} layerIdentifier If provided this will override the name used for the layer archive
 */
export type LambdaLayerProps = {
    layerName: string,
    description: string,
    environment?: {[key: string]: string}
    layerIdentifier?: string,
    architecture: Architecture,
};

export class LambdaLayer extends Construct {
    /**
   * The Lambda LayerVersion to use across Lambda functions.
   */
    public layerVersion: LayerVersion;

    constructor (scope: Construct, id: string, props: LambdaLayerProps) {
        super(scope, id);

        const { layerName, description, environment, layerIdentifier, architecture } = props;
        const layerFileName = layerIdentifier || layerName;
        const layerZip = path.join(WORKING_DIR, `lambda_dependencies/${layerFileName}_layer.zip`);
        let layerCode: Code;

        // prioritize manually built layers
        if (existsSync(layerZip)) {
            layerCode = Code.fromAsset(layerZip);
        } else {
            const buildDir = String(path.join(WORKING_DIR, 'build', 'layers', layerFileName));
            const layerDir = String(path.join(WORKING_DIR, 'lambda_dependencies', layerName));

            layerCode = this.cleanBuildDir(buildDir, layerDir, () => {
                const layerAsset = new Asset(this, 'LayerAsset', {
                    path: buildDir,
                    bundling: {
                        image: LAMBDA_RUNTIME.bundlingImage,
                        command: ['./create.sh'],
                        platform: architecture.dockerPlatform,
                        outputType: BundlingOutput.AUTO_DISCOVER,
                        securityOpt: 'no-new-privileges:true',
                        environment,
                        entrypoint: ['/bin/bash'],
                        workingDirectory: '/asset-input'
                    },
                });

                return Code.fromBucket(layerAsset.bucket, layerAsset.s3ObjectKey);
            });
        }

        this.layerVersion = new LayerVersion(scope, `mlspace-${layerFileName}-lambda-layer`, {
            description,
            compatibleArchitectures: [LAMBDA_ARCHITECTURE],
            compatibleRuntimes: [LAMBDA_RUNTIME],
            layerVersionName: `mlspace-${layerName}-layer`,
            code: layerCode,
        });
    }

    /**
   * Creates a clean build directory seeded by a {@param layerDir} for bundling a layer and
   * then removes it after the bundling is finished.
   *
   * @param buildDir The path to use for bundling
   * @param layerDir The source layer path
   */
    cleanBuildDir (buildDir: string, layerDir: string, bundleAction: () => Code) {
        // ensure nothing was leftover from before
        if (existsSync(buildDir)) {
            rmdirSync(buildDir, { recursive: true });
        }

        // create the build directory
        if (!mkdirSync(buildDir, { recursive: true })) {
            throw 'Unable to create directory';
        }

        // seed the buildDir with layerDir contents
        cpSync(layerDir, buildDir, { recursive: true });

        // actually do the bundling
        const code = bundleAction();

        // cleanup
        if (existsSync(buildDir)) {
            rmdirSync(buildDir, { recursive: true, });
        }

        return code;
    }
}

/**
 * Creates a {@link LambdaLayer} Construct from an existing layer archive or building a new
 * layer using Docker.
 *
 * @param {string} scope The {@link Construct} scope
 * @param {string} layerName - The name for the existing layer archive or to use when building
 * @param {string?} layerIdentifier If provided this will override the name used for the layer archive
 * @returns
 */
export function createLambdaLayer (
    scope: Construct,
    layerName: string,
    layerIdentifier?: string
): LambdaLayer {
    return new LambdaLayer(scope, layerIdentifier || layerName, {
        layerName,
        description: `Lambda layer for ${layerIdentifier} dependencies needed by MLSpace`,
        layerIdentifier,
        architecture: LAMBDA_ARCHITECTURE
    });
}