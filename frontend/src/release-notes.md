# v1.7.1  

This minor release addresses initial v1.7 customer feedback. These updates make deployments smoother and more secure. 

## Changes  

* **CDK Synthesizer Customization** — The synthesizer and its settings can now be configured. This flexibility gives teams greater control over infrastructure generation.  
* **Dependency Updates** — Third‑party libraries were upgraded to their latest versions to follow security best practices. Updated dependencies reduce exposure to known vulnerabilities and align with industry security standards.  
* **Ease Deployments**
    * Removed deprecated Lambda layer. This reduces package size and eliminates potential runtime conflicts.   
    * Ensured `ADCLambdaCABundleAspect` is added to the Core stack for isolated regions. Adding the CABundle aspect ensures proper certificate handling in isolated regions.  

## Bug Fixes  

* **Respect `AUTH_OIDC_VERIFY_SSL`** — Communication with the IdP now honors this configuration when SSL verification is disabled.  Honoring the SSL verification flag prevents unexpected connection failures for customers who need to bypass verification in controlled environments.  

## Documentation  

* Updated custom domain documentation
* Updated CDK synthesizer documentation



## Acknowledgements  

* @dustins  

**Full Changelog**: [v1.7.0…v1.7.1](https://github.com/awslabs/mlspace/compare/v1.7.0...v1.7.1)