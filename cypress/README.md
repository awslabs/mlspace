# Test Setup

In `cypress.config.ts` the following environment variables need to be configured:
- `auth_type` - The type of autentication used for the target MLSpace implementation. Cognito is recommended for development setups with configuration instructions in the MLSpace docs
- `base_url` - set to either `http://localhost:3000/` or the URL of your dev stack (e.g. `https://<api gateway id>.execute-api.us-east-1.amazonaws.com/Prod/`).
- `lambda_endpoint` - Only needed if `base_url` is targeting a localhost implementation. This should be the lambda APIs for the deployed MLSpace backend (e.g. `https://<api gateway id>.execute-api.us-east-1.amazonaws.com/Prod/`)
- `username` - The username that cypress will use to login and conduct tests
- `password` - The password cypress will attempt to use to login with the provided username

#### Example cypress.config.ts env setup for localhost:
```
env: {
    auth_type: AuthType.Cognito,
    base_url: "http://localhost:3000/Prod",
    lambda_endpoint: "https://abcde12345.execute-api.us-east-1.amazonaws.com/Prod",
    username: "myusername",
    password: "mypassword",
  }
```

# Running the tests

```
npm run cypress:run
```

You should get output like:
```
+ '[' '' ']'
+ npm-pretty-much run cypress:run

> mlspacee2e@1.0.0 cypress:run
> cypress run

[24884:0831/151718.226426:ERROR:gpu_memory_buffer_support_x11.cc(44)] dri3 extension not supported.

====================================================================================================

  (Run Starting)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Cypress:        12.5.1                                                                         │
  │ Browser:        Electron 106 (headless)                                                        │
  │ Node Version:   v18.16.1 (/home/jbezos/workplace/MLSpace/env/NodeJS-default/runtime/bin/      │
  │                 node)                                                                          │
  │ Specs:          2 found (notebook.spec.cy.ts, project.spec.cy.ts)                              │
  │ Searched:       cypress/e2e/**/*.cy.{js,jsx,ts,tsx}                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


────────────────────────────────────────────────────────────────────────────────────────────────────

  Running:  notebook.spec.cy.ts                                                             (1 of 2)


  Notebook Tests
    ✓ Create Notebook (10960ms)
    ✓ Stop Notebook (5410ms)
```

## Run tests interactively
```
npm run cypress:open
```

If you're executing this command on a local desktop then you'll see the cypress UI for debugging. 

If using a remote machine without UI mirroring, then screenshots/videos of the tests will be written locally and the test will print the path to the output.

```
  (Video)

  -  Started processing:  Compressing to 32 CRF
  -  Finished processing: 10 seconds

  -  Video output: /workplace/jbezos/MLSpace/src/...

    Compression progress:  100%
```

# Linting

To ensure that code is meeting the enforced code standards you can run the following command within the `cypress` directory:
```
npm run lint:fix
```

Linting will also run when executing the `act` command in the base project directory