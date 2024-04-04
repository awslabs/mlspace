---
outline: deep
---

# Administration

Users with Administrator permission can access {{ $params.APPLICATION_NAME }}’s Administration pages.

## Users

Through the Users list, Administrators can activate or suspend {{ $params.APPLICATION_NAME }} user accounts.
Once an account is activated, Administrators can grant a user the Administrator role. Once a user no longer
requires access to {{ $params.APPLICATION_NAME }}, an Administrator can suspend their account. If a user account is suspended it
doesn’t affect any of the account’s underlying resources and the resources will persist. Administrators can still
manage any projects that the suspended user was an owner of and can terminate any projects or resources
associated with the suspended user.

## Configuration

Administrators can view the current configurations for {{ $params.APPLICATION_NAME }}. If configuration settings need to be changed,
a system admin developer will need to make those modifications.

## Reports

Administrators can generate reports on resources across the {{ $params.APPLICATION_NAME }} application. These reports
allow Administrators to have a central place to check the status of all resources without having
to individually navigate into each project. Reports include metadata on resources such as instance type,
current status, start and stop time, etc. Reports are generated as CSVs. They are stored in the
{{ $params.APPLICATION_NAME }} Reports list and can be downloaded or deleted from the list as needed.