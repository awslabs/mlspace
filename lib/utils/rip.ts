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

import * as fs from 'fs';
import * as path from 'path';

type RegionInformationProviderData = {
    regions: Map<string | 'default', RegionInformation>
};

class RegionInformationProvider {
    regions: Map<string | 'default', RegionInformation>;

    constructor (data: RegionInformationProviderData) {
        this.regions = new Map(Object.entries(data.regions));
    }

    getRegionInformation (name: string): NamedRegionInformation {
        const regionInformation = this.regions.get(name) || this.regions.get('default')!;

        return new NamedRegionInformation(
            this.regions.has(name) ? name : 'default',
            new Map(Object.entries(regionInformation.supported)),
            regionInformation.availabilityZones,
            regionInformation.partitionPrefix
        );
    }
}

export type RegionInformation = {
    supported: Map<string, string[]>,
    availabilityZones?: string[],
    partitionPrefix?: string
};

export class NamedRegionInformation {
    name: string;
    supported: Map<string, string[]>;
    availabilityZones?: string[];
    partitionPrefix?: string;

    constructor (name: string, supported: Map<string, string[]>, availabilityZones?: string[], partitionPrefix?: string) {
        this.name = name;
        this.supported = supported;
        this.availabilityZones = availabilityZones;
        this.partitionPrefix = partitionPrefix;
    }
    
    isSupported (feature: string, id: string): boolean {
        return this.supported.get(feature)?.includes(id) || false;
    }
}

export function createRegionInformationProvider (): RegionInformationProvider {
    const configPath = path.join(__dirname, '..', 'region-information.json');
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    return new RegionInformationProvider(JSON.parse(rawConfig) as RegionInformationProviderData);
}