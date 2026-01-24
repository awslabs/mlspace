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
import { render, screen } from '@testing-library/react';
import { AuthErrorBoundary } from './components';

// Mock component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Test authentication error');
    }
    return <div>No error</div>;
};

describe('AuthErrorBoundary', () => {
    // Mock console.error to avoid noise in test output
    const originalConsoleError = console.error;
    beforeAll(() => {
        console.error = jest.fn();
    });
    
    afterAll(() => {
        console.error = originalConsoleError;
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    it('should render children when there is no error', () => {
        render(
            <AuthErrorBoundary>
                <ThrowError shouldThrow={false} />
            </AuthErrorBoundary>
        );
        
        expect(screen.getByText('No error')).toBeInTheDocument();
    });
    
    it('should catch errors and display error UI', () => {
        render(
            <AuthErrorBoundary>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        expect(screen.getByText('Authentication Error')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong with authentication. Please try refreshing the page.')).toBeInTheDocument();
        expect(screen.getByText('Refresh Page')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
    
    it('should log errors to console', () => {
        render(
            <AuthErrorBoundary>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        expect(console.error).toHaveBeenCalledWith(
            'Authentication error:',
            expect.any(Error),
            expect.any(Object)
        );
    });
    
    it('should call custom error handler when provided', () => {
        const mockOnError = jest.fn();
        
        render(
            <AuthErrorBoundary onError={mockOnError}>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        expect(mockOnError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.any(Object)
        );
    });
    
    it('should provide resetError function to custom fallback', () => {
        let capturedResetError: (() => void) | undefined;
        
        const CustomFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => {
            capturedResetError = resetError;
            return (
                <div>
                    <h3>Custom Error: {error.message}</h3>
                    <button onClick={resetError}>Reset Error</button>
                </div>
            );
        };
        
        render(
            <AuthErrorBoundary fallback={CustomFallback}>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        // Error UI should be displayed
        expect(screen.getByText('Custom Error: Test authentication error')).toBeInTheDocument();
        expect(screen.getByText('Reset Error')).toBeInTheDocument();
        
        // Verify resetError function is provided
        expect(capturedResetError).toBeDefined();
        expect(typeof capturedResetError).toBe('function');
    });
    
    it('should use custom fallback component when provided', () => {
        const CustomFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => (
            <div>
                <h3>Custom Error: {error.message}</h3>
                <button onClick={resetError}>Reset</button>
            </div>
        );
        
        render(
            <AuthErrorBoundary fallback={CustomFallback}>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        expect(screen.getByText('Custom Error: Test authentication error')).toBeInTheDocument();
        expect(screen.getByText('Reset')).toBeInTheDocument();
    });
    
    it('should track analytics when window.analytics is available', () => {
        const mockAnalytics = {
            track: jest.fn()
        };
        (window as any).analytics = mockAnalytics;
        
        render(
            <AuthErrorBoundary>
                <ThrowError shouldThrow={true} />
            </AuthErrorBoundary>
        );
        
        expect(mockAnalytics.track).toHaveBeenCalledWith('Auth Error', {
            error: 'Test authentication error',
            stack: expect.any(String),
            componentStack: expect.any(String)
        });
        
        // Clean up
        delete (window as any).analytics;
    });
});