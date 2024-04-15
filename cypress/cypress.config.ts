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

import { defineConfig } from "cypress";
import { AuthType } from "./cypress/support/test-initializer/types";

module.exports = defineConfig({
  e2e: {
    supportFile: "cypress/support/e2e.ts",
    experimentalStudio: true,
    setupNodeEvents(on: any, config: any) {
      // implement node event listeners here
    },
  },

  env: {
    auth_type: AuthType.Cognito,
    base_url: "",
    lambda_endpoint: "",
    username: "",
    password: "",
  },
});
