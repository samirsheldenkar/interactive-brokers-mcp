import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IBGatewayManager } from '../src/gateway-manager.js';
import { PortUtils } from '../src/utils/port-utils.js';
import https from 'https';

// Mock PortUtils
vi.mock('../src/utils/port-utils.js', () => ({
  PortUtils: {
    findExistingGateway: vi.fn(),
    isPortAvailable: vi.fn(),
    findAvailablePort: vi.fn(),
  }
}));

// Mock https
vi.mock('https');

describe('IBGatewayManager External Mode', () => {
  let manager: IBGatewayManager;

  beforeEach(() => {
    manager = new IBGatewayManager();
    vi.clearAllMocks();
  });

  it('should correctly set external mode', () => {
    manager.setExternalMode('192.168.1.100', 4001);
    expect(manager.getGatewayUrl()).toBe('https://192.168.1.100:4001');
    expect(manager.getCurrentPort()).toBe(4001);
  });

  it('should skip local startup in external mode', async () => {
    const mockReq = {
      on: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      destroy: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(https.request).mockImplementation((options: any, callback?: any) => {
      if (callback) callback({ statusCode: 200 } as any);
      return mockReq as any;
    });

    manager.setExternalMode('external-host', 5000);
    await manager.quickStartGateway();

    expect(manager.isGatewayReady()).toBe(true);
    expect(PortUtils.findExistingGateway).not.toHaveBeenCalled();
  });

  it('should throw error if external gateway is not reachable', async () => {
    const mockReq = {
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === 'error') {
          // Simulate error event
          setTimeout(() => cb(new Error('Connection refused')), 0);
        }
        return mockReq;
      }),
      end: vi.fn().mockReturnThis(),
      destroy: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(https.request).mockReturnValue(mockReq as any);

    manager.setExternalMode('unreachable-host', 5000);
    
    await expect(manager.quickStartGateway()).rejects.toThrow('External gateway not reachable at unreachable-host:5000');
  });

  it('should return correct gateway URL in external mode', () => {
    manager.setExternalMode('remote-gateway', 8888);
    expect(manager.getGatewayUrl()).toBe('https://remote-gateway:8888');
  });

  it('isGatewayReady should return true in external mode when ready', async () => {
    const mockReq = {
      on: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      destroy: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(https.request).mockImplementation((options: any, callback?: any) => {
      if (callback) callback({ statusCode: 200 } as any);
      return mockReq as any;
    });

    manager.setExternalMode('external-host', 5000);
    await manager.quickStartGateway();
    
    expect(manager.isGatewayReady()).toBe(true);
  });
});
