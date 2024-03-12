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

type IErrorBoundaryProps = {
    readonly children: React.ReactNode;
};

type IErrorBoundaryState = {
    readonly error: any;
    readonly errorInfo: any;
};

class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
    readonly state: IErrorBoundaryState = { error: undefined, errorInfo: undefined };

    componentDidCatch (error: any, errorInfo: any) {
        this.setState({
            error,
            errorInfo,
        });
    }

    render () {
        const { error, errorInfo } = this.state;
        if (errorInfo) {
            const errorDetails = (
                <details className='preserve-space'>
                    {error && error.toString()}
                    <br />
                    {errorInfo.componentStack}
                </details>
            );
            return (
                <div>
                    <h2 className='error'>An unexpected error has occurred.</h2>
                    {errorDetails}
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
