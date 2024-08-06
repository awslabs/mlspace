/**
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { IUser, Permission } from '../model/user.model';

export const togglePermission = (permission: Permission, permissions: Permission[]) => {
    if (permissions!.includes(permission)) {
        permissions.splice(permissions?.indexOf(permission), 1);
    } else {
        permissions.push(permission);
    }
};

export const hasPermission = (permission: Permission, permissions: Permission[] | undefined) => {
    return permissions ? permissions.includes(permission) : false;
};

export const isAdminOrOwner = (user: IUser, permissions: Permission[]) => {
    return (
        hasPermission(Permission.PROJECT_OWNER, permissions) ||
        hasPermission(Permission.ADMIN, user.permissions)
    );
};

export const enableProjectCreation = (isAdminOnly: boolean, user: IUser) => {
    if (isAdminOnly) {
        return hasPermission(Permission.ADMIN, user.permissions);
    } else {
        return true;
    }
};
