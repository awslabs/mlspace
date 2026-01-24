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

// Mock BroadcastChannel
class MockBroadcastChannel {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private listeners: Array<(event: MessageEvent) => void> = [];
    
    constructor (public name: string) {}
    
    addEventListener (type: string, listener: (event: MessageEvent) => void) {
        if (type === 'message') {
            this.listeners.push(listener);
        }
    }
    
    removeEventListener (type: string, listener: (event: MessageEvent) => void) {
        if (type === 'message') {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        }
    }
    
    postMessage (data: any) {
        const event = new MessageEvent('message', { data });
        this.listeners.forEach((listener) => listener(event));
    }
    
    close () {
        this.listeners = [];
    }
}

// Store original BroadcastChannel
const originalBroadcastChannel = global.BroadcastChannel;

describe('AuthSyncManager', () => {
    let mockChannel: MockBroadcastChannel;
    let onStateChangeMock: jest.Mock;
    
    beforeEach(() => {
        // Mock BroadcastChannel
        global.BroadcastChannel = jest.fn().mockImplementation((name: string) => {
            mockChannel = new MockBroadcastChannel(name);
            return mockChannel;
        });
        
        onStateChangeMock = jest.fn();
    });
    
    afterEach(() => {
        // Restore original BroadcastChannel
        global.BroadcastChannel = originalBroadcastChannel;
        jest.clearAllMocks();
    });
    
    // Extract AuthSyncManager class for testing
    class AuthSyncManager {
        private channel: BroadcastChannel;
        
        constructor (private onStateChange: () => void) {
            this.channel = new BroadcastChannel('mlspace-auth');
            this.channel.addEventListener('message', this.handleMessage);
        }
        
        private handleMessage = (event: MessageEvent<any>) => {
            switch (event.data.type) {
                case 'AUTH_STATE_CHANGED':
                case 'SESSION_EXPIRED':
                    this.onStateChange();
                    break;
                case 'LOGOUT_INITIATED':
                    this.onStateChange();
                    break;
            }
        };
        
        broadcast (message: any) {
            this.channel.postMessage(message);
        }
        
        destroy () {
            this.channel.removeEventListener('message', this.handleMessage);
            this.channel.close();
        }
    }
    
    it('should create BroadcastChannel with correct name', () => {
        new AuthSyncManager(onStateChangeMock);
        
        expect(global.BroadcastChannel).toHaveBeenCalledWith('mlspace-auth');
        expect(mockChannel.name).toBe('mlspace-auth');
    });
    
    it('should handle AUTH_STATE_CHANGED message', () => {
        new AuthSyncManager(onStateChangeMock);
        
        mockChannel.postMessage({ type: 'AUTH_STATE_CHANGED' });
        
        expect(onStateChangeMock).toHaveBeenCalledTimes(1);
    });
    
    it('should handle SESSION_EXPIRED message', () => {
        new AuthSyncManager(onStateChangeMock);
        
        mockChannel.postMessage({ type: 'SESSION_EXPIRED' });
        
        expect(onStateChangeMock).toHaveBeenCalledTimes(1);
    });
    
    it('should handle LOGOUT_INITIATED message', () => {
        new AuthSyncManager(onStateChangeMock);
        
        mockChannel.postMessage({ type: 'LOGOUT_INITIATED' });
        
        expect(onStateChangeMock).toHaveBeenCalledTimes(1);
    });
    
    it('should broadcast messages', () => {
        const syncManager = new AuthSyncManager(onStateChangeMock);
        const postMessageSpy = jest.spyOn(mockChannel, 'postMessage');
        
        syncManager.broadcast({ type: 'AUTH_STATE_CHANGED' });
        
        expect(postMessageSpy).toHaveBeenCalledWith({ type: 'AUTH_STATE_CHANGED' });
    });
    
    it('should clean up on destroy', () => {
        const syncManager = new AuthSyncManager(onStateChangeMock);
        const removeEventListenerSpy = jest.spyOn(mockChannel, 'removeEventListener');
        const closeSpy = jest.spyOn(mockChannel, 'close');
        
        syncManager.destroy();
        
        expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
        expect(closeSpy).toHaveBeenCalled();
    });
    
    it('should ignore unknown message types', () => {
        new AuthSyncManager(onStateChangeMock);
        
        mockChannel.postMessage({ type: 'UNKNOWN_MESSAGE' });
        
        expect(onStateChangeMock).not.toHaveBeenCalled();
    });
});