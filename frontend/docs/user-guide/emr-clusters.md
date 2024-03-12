---
outline: deep
---

# EMR Clusters
Users can create EMR clusters within a project. The EMR clusters page will list all active EMR clusters for the
given project as well as allow users to create new EMR clusters, view the details of existing EMR clusters,
and terminate EMR clusters. To read more about EMR, see the
[official documentation](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html).


## Create an EMR Cluster
From the EMR cluster dashboard users can create a new EMR cluster by selecting the "Create New EMR Cluster" button.
A user then needs to give the cluster a name, select a size for it, and select which EMR version to use. Amazon EMR will then provision infrastructure, configure clusters, and take care of all setup. Depending on the options selected, this provisioning process may take several minutes.


## EMR Cluster details
By clicking on an EMR cluster's name in the EMR cluster dashboard, a user can view the details page for that cluster.
The details page includes configuration information for that cluster such as the cluster ID, the EMR version, the state of the cluster, the auto-termination time, and the master DNS name.

If the user has the necessary permissions and the project owner has configured the project to allow EMR cluster
termination time overrides, then the user will be able to modify the auto-termination time of the EMR cluster.
Termination times are approximate and will execute when the next termination workflow runs at a configured time interval.
