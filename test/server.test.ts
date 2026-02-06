import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIBMCPServer } from '../src/server.js';
import { IBGatewayManager } from '../src/gateway-manager.js';
import { IBClient } from '../src/ib-client.js';

// Mock dependencies
vi.mock('../src/gateway-manager.js');
vi.mock('../src/ib-client.js');
vi.mock('../src/tools.js', () => ({
  registerTools: vi.fn(),
}));
vi.mock('../src/logger.js', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Server Initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should initialize gateway in external mode when IB_GATEWAY_EXTERNAL is true', async () => {
    const { createIBMCPServer } = await import('../src/server.js');
    const mockConfig = {
      IB_GATEWAY_EXTERNAL: true,
      IB_GATEWAY_HOST: 'external-host',
      IB_GATEWAY_PORT: 4001,
    };

    const mockSetExternalMode = vi.fn();
    const mockQuickStartGateway = vi.fn().mockResolvedValue(undefined);
    
    vi.mocked(IBGatewayManager).mockImplementation(() => ({
      setExternalMode: mockSetExternalMode,
      quickStartGateway: mockQuickStartGateway,
      getCurrentPort: vi.fn().mockReturnValue(4001),
    } as any));

    createIBMCPServer({ config: mockConfig as any });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockSetExternalMode).toHaveBeenCalledWith('external-host', 4001);
    expect(mockQuickStartGateway).toHaveBeenCalled();
  });

  it('should initialize gateway in local mode by default', async () => {
    const { createIBMCPServer } = await import('../src/server.js');
    const mockConfig = {
      IB_GATEWAY_EXTERNAL: false,
    };

    const mockSetExternalMode = vi.fn();
    const mockQuickStartGateway = vi.fn().mockResolvedValue(undefined);
    
    vi.mocked(IBGatewayManager).mockImplementation(() => ({
      setExternalMode: mockSetExternalMode,
      quickStartGateway: mockQuickStartGateway,
      getCurrentPort: vi.fn().mockReturnValue(5000),
    } as any));

    createIBMCPServer({ config: mockConfig as any });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockSetExternalMode).not.toHaveBeenCalled();
    expect(mockQuickStartGateway).toHaveBeenCalled();
  });
});
