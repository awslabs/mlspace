---
outline: deep
---

# Projects
All work in MLSpace is organized through projects. You cannot use any of the services without first selecting or creating a project.

There are two roles that a user may have in a project:
- Owner
    - May add and remove users from the project
    - May change the role of a user in a project
    - May suspend a project
    - May view all project resources
    - May modify the resource scheduling settings
- Member
    - May create new resources in the project
    - May access/use previously created project level resources

The primary landing page in MLSpace will list all available projects based on your identity as well as allow you to create a new projects.

Users will not be able to see any existing projects unless they are added to a project by one of the the project owners. When you create a new project, you will automatically be assigned as the project owner. You can then add additional users to the project and assign them ownership privileges as necessary.

## Creating Projects
MLSpace projects require a unique name between 3 and 24 characters in length (limited to alphanumeric characters) and a description (max length 4000 characters). Project name and descriptions will be visible on the MLSpace dashboard as well as the project details view.

An MLSpace project can also be configured to leverage resource scheduling. This is a feature where MLSpace will automatically terminate or stop resources after they have been active for a given length of time. This feature is useful for preventing unexpected costs that can come from forgotten resources.

* EMR clusters and SageMaker Endpoints can be configured to have a termination time. These resources will be terminated at the selected time and date. Termination times are approximate and will execute when the next termination workflow runs at a configured time interval.
* SageMaker Notebooks will automatically be stopped at the selected time each day.
* The project owner has the option to allow overrides. This enables users to modify the termination or stop times for resources that they created.

## Managing Projects

Once a user has created a project, they can easily manage the permission levels of collaborators from the project’s console view. Additional users can be searched for or selected from the list of users registered in the application. Their status as a project owner or regular user can be easily toggled from the project membership view. Users can see the default resource scheduling settings for the project. Users will also have the option of leaving or suspending a project.

### Edit Project Metadata and Resource Scheduling

1.	Navigate to a project.
2.	From the project details, select the "Actions" drop-down and click “Update”.
3.	Modify the fields to be edited and click "Update project”.

### Manage Members
1. Navigate to a project.
2. From the project details, select the "Actions" drop-down and click “Manage Members”.
3. You can click "Add user" to add a new project user which will result in a modal popping up that
lists users in the system which are not currently associated with the project.
4. Additional actions are available after selecting one or more users and then clicking the "Actions"
drop-down. The available actions will depend on the user(s) selected. Possible actions are toggling project
owner status, toggling collaborator status, and removing the selected user(s) from the project.
    1. Removing a user from a project will trigger all the changes covered under the "Leave Project" section.

### Suspending Project
- Suspending a project will stop all associated resources (eg, notebooks and endpoints) and flag the project as suspended
- Once a project is suspended, it will no longer be visible to regular user of the application, but resources associated with the project will NOT be deleted, only stopped
- Suspending a project may take some time depending on the number of active resources associated with the project
- MLSpace administrators can continue to view suspended projects and the associated resources and optionally reinstate a suspended project

## Leaving Project
- When a user leaves a project it will remove their association with that project and have the following effects:
    - The user will no longer see the project on their MLSpace dashboard
    - The user will no longer be able to create resources associated with that project
    - Leaving a project will affect the following resources:
        - Notebooks created by the user in the project will be stopped
        - EMR clusters created by the user in the project will be terminated
        - Batch translate jobs created by the user in the project will be stopped
        - All other resources the user created in the project will be unaffected
    - If you are added back to the project, your resources associated with the project from before you left will still be available to you
- You may leave a project from the ‘Leave project’ button on the project overview page under the actions drop-down
- If you are the only Project Owner for a project you may not leave a project until you promote another user to Project Owner



