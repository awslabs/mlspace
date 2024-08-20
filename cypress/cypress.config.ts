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

import { defineConfig } from 'cypress';
import { AuthType } from './cypress/support/test-initializer/types';

module.exports = defineConfig({
    e2e: {
        supportFile: 'cypress/support/e2e.ts',
        experimentalStudio: true,
        setupNodeEvents () {
            // implement node event listeners here
        },
    },

    env: {
        auth_type: AuthType.Cognito,
        base_url: 'http://localhost:3000/Prod',
        // lambda_endpoint is only needed if base_url targets a localhost implementation
        lambda_endpoint: 'https://014tnqj9sg.execute-api.us-east-1.amazonaws.com/Prod/',
        // eslint-disable-next-line spellcheck/spell-checker
        username: 'pmo',
        // eslint-disable-next-line spellcheck/spell-checker
        password: 'N@w<7Aab+Ae!',
        account_id: '905418056524',
    },
});
