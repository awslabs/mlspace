# v1.6.9

## Enhancements
- Added support for custom permission boundary to all stacks, this includes ensuring IAM prefixes are applied to all application created roles. This allows customers to provide a more constrained permission boundary for the application.
- Updated documentation to make it more clear about deployment platform expectations

## Security
- Upgraded esbuild dependency to resolve potential CORS settings issue

## Acknowledgements
* @bedanley
* @dustins
* @estohlmann

**Full Changelog**: https://github.com/awslabs/mlspace/compare/v1.6.8...v1.6.9