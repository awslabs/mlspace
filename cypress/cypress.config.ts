import { defineConfig } from "cypress";

module.exports = defineConfig({
  e2e: {
    supportFile: "cypress/support/e2e.ts",
    experimentalStudio: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },

  env: {
    base_url: "",
    username: "",
    password: "",
  },
});
