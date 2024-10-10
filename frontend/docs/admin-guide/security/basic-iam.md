# Basic AWS IAM

For an indepth understanding you can visit the [AWS IAM](https://aws.amazon.com/iam/) site but a brief expalnation is provided below.

## Statements

A statement is a declaration that associates one or more actions with one or more resources and specifies an effect (allow or deny). Additionally, you can declare conditions to restrict the statement's applicability to specific situations. For instance, you could create a declaration that allows feeding Gary the Goat at the zoo under certain circumstances, as demonstrated in the example below.

```json
{
    "Action": ["Feed", "Pet"],
    "Resource": ["GaryGoat", "PerryPiglet"],
    "Effect": "Allow",
}
```

In real statements, _actions_ have a prefix like (`<service>:`) for the service they're related to. So in this example the action might be `zoo:Feed`. Another difference (besides there is no AWS Zoo service yet) is AWS _resources_ are identified by [an ARN](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html). This makes them look more complciated but they're still just used to identify resources. So the example above might look more like below in the real world.

In actual statements, actions are prefixed with the service they relate to, such as `<service>:`. For instance, the action might be `zoo:Feed`. Additionally, unlike the example, AWS resources are identified by an [Amazon Resource Name](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html) (ARN), which can make them appear more complex. However, they still serve the purpose of identifying resources. As a result, the example above might resemble the following in a real-world scenario.


```json
{
    "Action": ["zoo:Feed", "zoo:Pet"],
    "Resource": [
        "arn:aws:zoo:us-east-1:012345678910:animal/GaryGoat",
        "arn:aws:zoo:us-east-1:012345678910:animal/PerryPiglet",
    ],
    "Effect": "Allow",
}
```

Finally, as mentioned earlier, conditions can be applied to statements. In this example, we've replaced specific animal resources with a wildcard (`*`), allowing the actions to be performed on any animal. However, we've added a condition that restricts these actions to only friendly animals. It's important to note that this statement still does not permit interactions with potentially dangerous animals, such as Barry Badger.

```json
{
    "Action": ["zoo:Feed", "zoo:Pet"],
    "Resource": [
        "arn:aws:zoo:us-east-1:012345678910:animal/*",
    ],
    "Effect": "Allow",
    "Conditions": {
        "Bool": {
            "zoo:AnimalFriendly": "true"
        }
    }
}
```

## Policies

Policies are collections of one or more statements that define a set of permissions. To illustrate this, let's create a policy for a zoo volunteer by combining the previous statement with another statement that allows cleaning animal enclosures, but only if they are not free-range animals.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": ["zoo:Feed", "zoo:Pet"],
            "Resource": [
                "arn:aws:zoo:us-east-1:012345678910:animal/*",
            ],
            "Effect": "Allow",
            "Conditions": {
                "Bool": {
                    "zoo:AnimalFriendly": "true"
                }
            }
        },
        {
            "Action": ["zoo:CleanEnclosure"],
            "Resource": [
                "arn:aws:zoo:us-east-1:012345678910:animal/*",
            ],
            "Effect": "Allow",
            "Conditions": {
                "Bool": {
                    "zoo:FreeRange": "false"
                }
            }
        },
    ]
}
```

## Roles

## Roles

Roles are essentially collections of one or more policies bundled together. For instance, a `Volunteer` role might consist solely of the policy created above. In contrast, a `ZooKeeper` role would likely incorporate additional policies, granting permission for a broader range of actions to be performed on various resources.