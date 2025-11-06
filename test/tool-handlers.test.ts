// test/tool-handlers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolHandlers, ToolHandlerContext } from '../src/tool-handlers.js';
import { IBClient } from '../src/ib-client.js';
import { IBGatewayManager } from '../src/gateway-manager.js';

// Mock dependencies
vi.mock('../src/ib-client.js');
vi.mock('../src/gateway-manager.js');
vi.mock('../src/headless-auth.js');
vi.mock('open', () => ({ default: vi.fn() }));

describe('ToolHandlers', () => {
  let handlers: ToolHandlers;
  let mockIBClient: IBClient;
  let mockGatewayManager: IBGatewayManager;
  let context: ToolHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock IBClient
    mockIBClient = {
      checkAuthenticationStatus: vi.fn().mockResolvedValue(true),
      getAccountInfo: vi.fn().mockResolvedValue({ accounts: [] }),
      getPositions: vi.fn().mockResolvedValue([]),
      getMarketData: vi.fn().mockResolvedValue({ price: 150 }),
      placeOrder: vi.fn().mockResolvedValue({ orderId: '123' }),
      getOrderStatus: vi.fn().mockResolvedValue({ status: 'Filled' }),
      getOrders: vi.fn().mockResolvedValue([]),
      confirmOrder: vi.fn().mockResolvedValue({ confirmed: true }),
      destroy: vi.fn(),
      updatePort: vi.fn(),
    } as any;

    // Create mock GatewayManager
    mockGatewayManager = {
      ensureGatewayReady: vi.fn().mockResolvedValue(undefined),
      getCurrentPort: vi.fn().mockReturnValue(5000),
      start: vi.fn(),
      stop: vi.fn(),
    } as any;

    // Create context
    context = {
      ibClient: mockIBClient,
      gatewayManager: mockGatewayManager,
      config: {
        IB_HEADLESS_MODE: false,
        IB_GATEWAY_HOST: 'localhost',
        IB_GATEWAY_PORT: 5000,
      },
    };

    handlers = new ToolHandlers(context);
  });

  describe('getAccountInfo', () => {
    it('should return account information', async () => {
      const mockAccounts = [{ id: 'U12345', accountId: 'U12345' }];
      mockIBClient.getAccountInfo = vi.fn().mockResolvedValue({ accounts: mockAccounts });

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockGatewayManager.ensureGatewayReady).toHaveBeenCalled();
      expect(mockIBClient.getAccountInfo).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockIBClient.getAccountInfo = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('API Error');
    });
  });

  describe('getPositions', () => {
    it('should return positions for account', async () => {
      const mockPositions = [{ symbol: 'AAPL', position: 10 }];
      mockIBClient.getPositions = vi.fn().mockResolvedValue(mockPositions);

      const result = await handlers.getPositions({ accountId: 'U12345' });

      expect(result.content).toBeDefined();
      expect(mockIBClient.getPositions).toHaveBeenCalledWith('U12345');
    });

    it('should handle missing accountId', async () => {
      const result = await handlers.getPositions({} as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Account ID is required');
    });
  });

  describe('getMarketData', () => {
    it('should return market data for symbol', async () => {
      const mockData = { symbol: 'AAPL', price: 150.25 };
      mockIBClient.getMarketData = vi.fn().mockResolvedValue(mockData);

      const result = await handlers.getMarketData({ symbol: 'AAPL' });

      expect(result.content).toBeDefined();
      expect(mockIBClient.getMarketData).toHaveBeenCalledWith('AAPL', undefined);
    });

    it('should pass exchange parameter', async () => {
      const mockData = { symbol: 'AAPL', price: 150.25 };
      mockIBClient.getMarketData = vi.fn().mockResolvedValue(mockData);

      await handlers.getMarketData({ symbol: 'AAPL', exchange: 'NASDAQ' });

      expect(mockIBClient.getMarketData).toHaveBeenCalledWith('AAPL', 'NASDAQ');
    });
  });

  describe('placeOrder', () => {
    it('should place market order', async () => {
      const mockResponse = { orderId: '123', status: 'Submitted' };
      mockIBClient.placeOrder = vi.fn().mockResolvedValue(mockResponse);

      const orderInput = {
        accountId: 'U12345',
        symbol: 'AAPL',
        action: 'BUY' as const,
        orderType: 'MKT' as const,
        quantity: 10,
      };

      const result = await handlers.placeOrder(orderInput);

      expect(result.content).toBeDefined();
      expect(mockIBClient.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'U12345',
          symbol: 'AAPL',
          action: 'BUY',
          orderType: 'MKT',
          quantity: 10,
        })
      );
    });

    it('should place limit order with price', async () => {
      const mockResponse = { orderId: '123', status: 'Submitted' };
      mockIBClient.placeOrder = vi.fn().mockResolvedValue(mockResponse);

      const orderInput = {
        accountId: 'U12345',
        symbol: 'AAPL',
        action: 'BUY' as const,
        orderType: 'LMT' as const,
        quantity: 10,
        price: 150.50,
      };

      await handlers.placeOrder(orderInput);

      expect(mockIBClient.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 150.50,
        })
      );
    });

    it('should handle order placement errors', async () => {
      mockIBClient.placeOrder = vi.fn().mockRejectedValue(new Error('Order failed'));

      const orderInput = {
        accountId: 'U12345',
        symbol: 'AAPL',
        action: 'BUY' as const,
        orderType: 'MKT' as const,
        quantity: 10,
      };

      const result = await handlers.placeOrder(orderInput);

      expect(result.content[0].text).toContain('Order failed');
    });
  });

  describe('getLiveOrders', () => {
    it('should return all live orders', async () => {
      const mockOrders = [{ orderId: '123', status: 'Working' }];
      mockIBClient.getOrders = vi.fn().mockResolvedValue(mockOrders);

      const result = await handlers.getLiveOrders({});

      expect(result.content).toBeDefined();
      expect(mockIBClient.getOrders).toHaveBeenCalledWith(undefined);
    });

    it('should always fetch all orders without account parameter', async () => {
      const mockOrders = [{ orderId: '123', status: 'Working' }];
      mockIBClient.getOrders = vi.fn().mockResolvedValue(mockOrders);

      const result = await handlers.getLiveOrders({});

      expect(mockIBClient.getOrders).toHaveBeenCalledWith(undefined);
      expect(result.content).toBeDefined();
    });
  });

  describe('getOrderStatus', () => {
    it('should return order status', async () => {
      const mockStatus = { orderId: '123', status: 'Filled' };
      mockIBClient.getOrderStatus = vi.fn().mockResolvedValue(mockStatus);

      const result = await handlers.getOrderStatus({ orderId: '123' });

      expect(result.content).toBeDefined();
      expect(mockIBClient.getOrderStatus).toHaveBeenCalledWith('123');
    });
  });

  describe('confirmOrder', () => {
    it('should confirm order', async () => {
      const mockResponse = { confirmed: true };
      mockIBClient.confirmOrder = vi.fn().mockResolvedValue(mockResponse);

      const result = await handlers.confirmOrder({
        replyId: 'reply-123',
        messageIds: ['msg1', 'msg2'],
      });

      expect(result.content).toBeDefined();
      expect(mockIBClient.confirmOrder).toHaveBeenCalledWith('reply-123', ['msg1', 'msg2']);
    });
  });

  describe('Headless Mode Authentication', () => {
    it('should trigger auth in headless mode', async () => {
      context.config.IB_HEADLESS_MODE = true;
      context.config.IB_USERNAME = 'testuser';
      context.config.IB_PASSWORD_AUTH = 'testpass';
      
      mockIBClient.checkAuthenticationStatus = vi.fn()
        .mockResolvedValueOnce(false) // First check: not authenticated
        .mockResolvedValueOnce(true);  // After auth: authenticated

      handlers = new ToolHandlers(context);

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should format authentication errors', async () => {
      const authError = new Error('Authentication required');
      (authError as any).isAuthError = true;
      
      mockIBClient.getAccountInfo = vi.fn().mockRejectedValue(authError);

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content[0].text).toContain('Authentication required');
    });

    it('should format generic errors', async () => {
      mockIBClient.getAccountInfo = vi.fn().mockRejectedValue(new Error('Generic error'));

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content[0].text).toContain('Generic error');
    });

    it('should handle non-Error objects', async () => {
      mockIBClient.getAccountInfo = vi.fn().mockRejectedValue('String error');

      const result = await handlers.getAccountInfo({ confirm: true });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('String error');
    });
  });

  describe('Flex Query Tools', () => {
    describe('getFlexQuery', () => {
      it('should return error when flex query client is not configured', async () => {
        // Context without flex query client (using the one from beforeEach which has no flex client)
        const result = await handlers.getFlexQuery({
          queryId: '123456',  
          parseXml: false,  
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.error).toBe('Flex Query feature not configured');
        expect(response.message).toContain('IB_FLEX_TOKEN');
      });

      it('should execute flex query when configured', async () => {
        // Create a fresh context with flex query configuration
        const mockFlexQueryClient = {
          executeQuery: vi.fn().mockResolvedValue({
            data: '<?xml version="1.0"?><FlexQueryResponse queryName="Test Query"><FlexStatements><FlexStatement /></FlexStatements></FlexQueryResponse>',
          }),
          parseStatement: vi.fn().mockResolvedValue({
            FlexQueryResponse: {
              queryName: 'Test Query',
              FlexStatements: {},
            },
          }),
        };

        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(null),
          saveQuery: vi.fn().mockResolvedValue({
            id: 'query_1',
            name: 'Test Query',
            queryId: '123456',
            createdAt: '2023-01-01T00:00:00.000Z',
          }),
          markQueryUsed: vi.fn().mockResolvedValue(undefined),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        // Create NEW context with flex query setup
        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryClient: mockFlexQueryClient as any,
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.getFlexQuery({
          queryId: '123456',  
          parseXml: false,
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.queryId).toBe('123456');
        expect(response.autoSaved).toBe(true);
        expect(mockFlexQueryClient.executeQuery).toHaveBeenCalledWith('123456');
        expect(mockFlexQueryStorage.saveQuery).toHaveBeenCalled();
      });

      it('should mark query as used when already exists', async () => {
        const existingQuery = {
          id: 'query_1',
          name: 'Existing Query',
          queryId: '123456',
          createdAt: '2023-01-01T00:00:00.000Z',
        };

        const mockFlexQueryClient = {
          executeQuery: vi.fn().mockResolvedValue({
            data: '<?xml version="1.0"?><FlexQueryResponse queryName="Test Query"><FlexStatements /></FlexQueryResponse>',
          }),
          parseStatement: vi.fn().mockResolvedValue({
            FlexQueryResponse: {
              queryName: 'Test Query',
            },
          }),
        };

        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(existingQuery),
          markQueryUsed: vi.fn().mockResolvedValue(undefined),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryClient: mockFlexQueryClient as any,
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.getFlexQuery({
          queryId: '123456',
          parseXml: false,
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.autoSaved).toBe(false);
        expect(mockFlexQueryStorage.markQueryUsed).toHaveBeenCalledWith('query_1');
      });

      it('should handle flex query errors', async () => {
        const mockFlexQueryClient = {
          executeQuery: vi.fn().mockResolvedValue({
            error: 'Invalid query ID',
            errorCode: '1001',
          }),
        };

        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(null),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryClient: mockFlexQueryClient as any,
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.getFlexQuery({
          queryId: '123456',
          parseXml: false,
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.error).toBe('Invalid query ID');
        expect(response.errorCode).toBe('1001');
      });
    });

    describe('listFlexQueries', () => {
      it('should return error when not configured', async () => {
        const result = await handlers.listFlexQueries({ confirm: true });

        const response = JSON.parse(result.content[0].text);
        expect(response.error).toBe('Flex Query feature not configured');
      });

      it('should list all saved queries', async () => {
        const mockQueries = [
          {
            id: 'query_1',
            name: 'Query 1',
            queryId: '123',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'query_2',
            name: 'Query 2',
            queryId: '456',
            createdAt: '2023-01-02T00:00:00.000Z',
          },
        ];

        const mockFlexQueryStorage = {
          listQueries: vi.fn().mockResolvedValue(mockQueries),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path/flex-queries.json'),
        };

        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.listFlexQueries({ confirm: true });

        const response = JSON.parse(result.content[0].text);
        expect(response.count).toBe(2);
        expect(response.queries).toHaveLength(2);
        expect(response.storageLocation).toBe('/mock/path/flex-queries.json');
      });
    });

    describe('forgetFlexQuery', () => {
      it('should return error when not configured', async () => {
        const result = await handlers.forgetFlexQuery({ queryId: '123456' });

        const response = JSON.parse(result.content[0].text);
        expect(response.error).toBe('Flex Query feature not configured');
      });

      it('should delete query by queryId', async () => {
        const existingQuery = {
          id: 'query_1',
          name: 'Test Query',
          queryId: '123456',
          createdAt: '2023-01-01T00:00:00.000Z',
        };

        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(existingQuery),
          getQueryByName: vi.fn().mockResolvedValue(null),
          deleteQuery: vi.fn().mockResolvedValue(true),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.forgetFlexQuery({ queryId: '123456' });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.message).toContain('Test Query');
        expect(mockFlexQueryStorage.deleteQuery).toHaveBeenCalledWith('query_1');
      });

      it('should try name lookup as fallback', async () => {
        const existingQuery = {
          id: 'query_1',
          name: 'Test Query',
          queryId: '123456',
          createdAt: '2023-01-01T00:00:00.000Z',
        };

        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(null),
          getQueryByName: vi.fn().mockResolvedValue(existingQuery),
          deleteQuery: vi.fn().mockResolvedValue(true),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        const flexContext: ToolHandlerContext = {
          ibClient: mockIBClient,
          gatewayManager: mockGatewayManager,
          config: {
            ...context.config,
            IB_FLEX_TOKEN: 'test-token',
          },
          flexQueryStorage: mockFlexQueryStorage as any,
        };

        const flexHandlers = new ToolHandlers(flexContext);

        const result = await flexHandlers.forgetFlexQuery({ queryId: 'Test Query' });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(mockFlexQueryStorage.getQueryByName).toHaveBeenCalledWith('Test Query');
      });

      it('should return error when query not found', async () => {
        const mockFlexQueryStorage = {
          getQueryByQueryId: vi.fn().mockResolvedValue(null),
          getQueryByName: vi.fn().mockResolvedValue(null),
          initialize: vi.fn().mockResolvedValue(undefined),
          getStorageFilePath: vi.fn().mockReturnValue('/mock/path'),
        };

        context.config.IB_FLEX_TOKEN = 'test-token';
        context.flexQueryStorage = mockFlexQueryStorage as any;
        handlers = new ToolHandlers(context);

        const result = await handlers.forgetFlexQuery({ queryId: 'nonexistent' });

        const response = JSON.parse(result.content[0].text);
        expect(response.error).toBe('Query not found');
        expect(response.message).toContain('nonexistent');
      });
    });
  });
});

