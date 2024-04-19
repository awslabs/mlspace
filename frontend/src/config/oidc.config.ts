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

import { AuthProviderProps } from 'react-oidc-context';
import { User } from 'oidc-client-ts';
import axios from '../shared/util/axios-utils';
import { IUser } from '../shared/model/user.model';

export const oidcConfig: AuthProviderProps = {
    authority: window.env.OIDC_URL,
    client_id: window.env.OIDC_CLIENT_NAME,
    redirect_uri: window.env.OIDC_REDIRECT_URI,
    post_logout_redirect_uri: window.env.OIDC_REDIRECT_URI,
    scope: 'openid profile email',
    onSigninCallback: async (user: User | void) => {
        window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.hash}`
        );
        user!.profile.preferred_username = user!.profile.preferred_username!.replace(/,|\.|=| /gi, '-');
        const mlspaceUser = {
            username: user!.profile.preferred_username,
            email: user!.profile.email,
            name: user!.profile.name,
        };
        try {
            await axios.post<IUser>('/user', mlspaceUser);
        } catch (err) {
            // Do nothing here because an error just means the user already exists
        }
        // Update user's lastLogin attribute after page refresh/login
        await axios.put<IUser>('/login', mlspaceUser);
    },
};
