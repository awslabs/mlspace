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

import axios from '../../shared/util/axios-utils';

export const getCustomTerminologyList = async () => {
    const response = await axios.get('/translate/custom-terminologies');

    const output: { label: string; value: string }[] = [];
    for (const term of response.data.records) {
        output.push({
            label: term.Name,
            value: term.Name,
        });
    }
    return output;
};

export const getTranslateLanguagesList = async () => {
    const response = await axios.get('/translate/list-languages');

    const output: { label: string; value: string }[] = [];
    for (const language of response.data) {
        if (language.LanguageCode !== 'auto') {
            output.push({
                label: `${language.LanguageName} (${language.LanguageCode})`,
                value: language.LanguageCode,
            });
        }
    }
    return output;
};
