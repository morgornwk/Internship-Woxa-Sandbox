import { WebsocketGateway } from './websocket.gateway';
import { JwtService } from '@nestjs/jwt';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let jwtService: { verifyAsync: jest.Mock };

  const makeServer = () => ({
    emit: jest.fn(),
    sockets: {
      sockets: new Map<string, any>(),
    },
  });

  const makeSocket = (overrides: any = {}) => ({
    id: 'sock-1',
    handshake: { auth: { token: 't' } },
    disconnect: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    gateway = new WebsocketGateway(jwtService as unknown as JwtService);
  });

  it('disconnects when no token provided', async () => {
    const server = makeServer();
    (gateway as any).server = server;

    const socket = makeSocket({ handshake: { auth: {} } });
    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('disconnects when token invalid', async () => {
    const server = makeServer();
    (gateway as any).server = server;
    jwtService.verifyAsync.mockRejectedValue(new Error('bad'));

    const socket = makeSocket();
    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('disconnects when payload missing sub', async () => {
    const server = makeServer();
    (gateway as any).server = server;
    jwtService.verifyAsync.mockResolvedValue({});

    const socket = makeSocket();
    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('tracks user connection and emits online', async () => {
    const server = makeServer();
    (gateway as any).server = server;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1' });

    const socket = makeSocket({ id: 'sock-1' });
    await gateway.handleConnection(socket);

    expect(server.emit).toHaveBeenCalledWith('user_online', 'u1');
  });

  it('disconnects previous socket if user reconnects', async () => {
    const server = makeServer();
    (gateway as any).server = server;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1' });

    const oldSocket = { disconnect: jest.fn() };
    server.sockets.sockets.set('old-sock', oldSocket);

    // prime internal maps by calling handleConnection once
    const first = makeSocket({ id: 'old-sock' });
    await gateway.handleConnection(first);

    const second = makeSocket({ id: 'new-sock' });
    await gateway.handleConnection(second);

    expect(oldSocket.disconnect).toHaveBeenCalled();
  });

  it('emits offline on disconnect when tracked', async () => {
    const server = makeServer();
    (gateway as any).server = server;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1' });

    const socket = makeSocket({ id: 'sock-1' });
    await gateway.handleConnection(socket);
    await gateway.handleDisconnect(socket);

    expect(server.emit).toHaveBeenCalledWith('user_offline', 'u1');
  });
});
