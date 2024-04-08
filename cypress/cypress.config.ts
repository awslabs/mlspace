import { defineConfig } from "cypress";
import { AuthType } from "./cypress/support/test-initializer/types";

module.exports = defineConfig({
  e2e: {
    supportFile: "cypress/support/e2e.ts",
    experimentalStudio: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },

  env: {
    auth_type: AuthType.Cognito,
    base_url: "",
    username: "",
    password: "",
  },
});
