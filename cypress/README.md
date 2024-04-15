# Test Setup

In `cypress.config.ts` change the `base_url` field to either `http://localhost:3000/` or the URL of your dev stack.

```
<TBD>
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