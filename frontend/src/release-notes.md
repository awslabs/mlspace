# Release 1.6.1
## Key Features
### Datasets
- Multiple Groups can now be assigned to a Dataset
- All of the Datasets that a Group has access to are listed on the Group’s details page
- Admins now have the ability to easily monitor Datasets access in MLSpace. Orphaned Datasets are flagged for Admins attention to prevent loss of data and ownership.

### Group/Project Association
- Groups can now be added to Projects as Project collaborators or owners. The associated role will be inherited by every member of the Group
- All of the Projects that a Group has access to are listed on the Group’s details page

## Enhancements
- The latest release notes are now displayed on the login page as another example custom component

## Bug Fixes
- System Banner text is now bold
- System version is now shown without scrolling if banner is enabled
- Group breadcrumbs weren't updating correctly
- Dynamic Role user polices now use correct s3 group resources

## Acknowledgements
* @douglas1850
* @dustins
* @estohlmann

**Full Changelog**: https://github.com/awslabs/mlspace/compare/v1.6.0...v1.6.1