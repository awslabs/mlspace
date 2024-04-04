---
outline: deep
---

# Grant Admin Permissions to Initial Admin
By default users are created without any elevated privileges and, depending on the value set for `NEW_USERS_SUSPENDED`, will be created in a suspended state unable to interact with the application. In order to grant the inital Admin elevated privileges you'll need to modify the user record in Dynamo DB. Subsequent users can have permissions/suspension state managed directly in the {{ $params.APPLICATION_NAME }} UI by any user with the `PMO` permission.
## Using the AWS CLI

You can use the aws CLI to make the necessary update, be sure to set the correct region and username. If you’ve updated the table name from the default you’ll also need to ensure that is correct.
```
aws dynamodb --region us-east-1 update-item \
    --table-name mlspace-users \
    --key '{ "username": {"S": "<username here>"}}' \
    --update-expression "SET #p = :newval, suspended=:boolval" \
    --expression-attribute-names '{"#p":"permissions"}' \
    --expression-attribute-values '{":newval":{"L":[{"S":"PMO"}]}, ":boolval":{"BOOL":false}}' \
    --return-values ALL_NEW
```


## Using the AWS console

Login to the AWS account you’ve deployed {{ $params.APPLICATION_NAME }} to as a user with write permissions to DynamoDB (Admin works)
![AWS Console](../img/initial-admin/aws-dashboard.png)
Navigate to the DynamoDB console
![DynamoDB Dashboard](../img/initial-admin/ddb-dashboard.png)
Select “Explore Items” on the lefthand side under “Tables”
![DynamoDB explore table](../img/initial-admin/ddb-explore.png)
Select the “mlspace-users” table from the “Tables” list (if you renamed this table as part of setup select the correct users table)
![DynamoDB table items](../img/initial-admin/ddb-users.png)
Next select the checkmark next to the user you wish to make an admin and click “Actions” -> “Edit Item”
![Select DDB record to edit](../img/initial-admin/ddb-users-actions.png)
Next to the “permissions” attribute select “Insert a field” to open the field type dropdown and select “String”
![Edit DDB record](../img/initial-admin/ddb-edit-permissions.png)
In the resulting text box enter “PMO” and click “Save changes” in the bottom right
![Save DDB record changes](../img/initial-admin/ddb-edit-pmo.png)
Verify the item has been correctly updated in the items view
![Record updated successfully](../img/initial-admin/ddb-updated-pmo.png)

__If neccessary you can use the same process to update a users suspended status__