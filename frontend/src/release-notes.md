# Release 1.6.2
## Key Features
### Group Membership Auditing
- In the group details page users will now be able to see when users are added and removed from a group
- This information will contain who was added, when they were added, who conducted the action, and when the action happened
- The data will persist in Dynamo even if the group is deleted so if an Admin has to do user access research the data will still be available

## Enhancements
- Remove deprecated constants from CDK
- Removed un-used CO permission scheme from all Back-End code
- MLSpace will now display the number of group members in a group in the table display
- Updated the AppConfig confirmation screen to show user-friendly field names 

## Bug Fixes
- Fixed bug where AppConfig would potentially error out when getting pulled into the UI
- Merged in a CVE fix by a 3rd Party `Axios`

## Acknowledgements
* @douglas1850
* @dustins
* @estohlmann

**Full Changelog**: https://github.com/awslabs/mlspace/compare/v1.6.1...v1.6.2
