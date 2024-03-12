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

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import getStore, { persistor } from './config/store';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from './config/oidc.config';
import { PersistGate } from 'redux-persist/integration/react';
import { I18nProvider } from '@cloudscape-design/components/i18n';
// Only import English
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';

const store = getStore();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <Provider store={store}>
            <PersistGate persistor={persistor}>
                <AuthProvider {...oidcConfig}>
                    <div>
                        <I18nProvider messages={[enMessages]}>
                            <App />
                        </I18nProvider>
                    </div>
                </AuthProvider>
            </PersistGate>
        </Provider>
    </React.StrictMode>
);
