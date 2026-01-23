# v1.7

## Features

* **Redesigned Authentication System**: MLSpace now supports a wider range of identity providers through a redesigned authentication flow. The new backend-driven approach enables integration with identity providers that require secure server-side authentication. This change is fully backward compatible—existing login methods continue to work with only configuration changes. While the user experience remains the same, the authentication process now happens server-side rather than in the browser, providing better compatibility with a wider variety of identify providers.
* **Custom Domain Support**: MLSpace now includes initial support for using a custom domain instead of the default API Gateway domain.
* **Enhanced Configuration Helper:** The configuration helper has been updated to support the new authentication parameters and custom domain configuration, making it easier to set up and deploy MLSpace with these new capabilities.
* Updated dependencies with the latest security patches.

## Documentation

* Added comprehensive documentation for configuring the new authentication system with various examples.
* Added instructions for setting up and configuring a custom domain for MLSpace deployments.

## Special Thanks

* 🎉 Special thanks to [@emacthecav](https://github.com/awslabs/mlspace/pull/345) for contributing their first PR!

## Acknowledgements

* @dustins
* @estohlmann

**Full Changelog**: [v1.6.11...v1.7](https://github.com/awslabs/mlspace/compare/v1.6.11...v1.7)
