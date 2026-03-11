import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
    path: '/socket.io',
    cors: {
        origin:
            [
                'https://skllracademy.com',
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:5500',
                'http://localhost:5500'
            ],
        credentials: true,
    },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private readonly server: Server;

    private readonly userToSocket = new Map<string, string>();
    private readonly socketToUser = new Map<string, string>();
    private readonly logger = new Logger(WebsocketGateway.name);

    constructor(private readonly jwtService: JwtService) { }

    // ผู้ใช้เชื่อมต่อ - ใช้ Access Token เท่านั้น
    async handleConnection(socket: Socket): Promise<void> {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                this.logger.warn('Connection rejected: No token provided');
                socket.disconnect();
                return;
            }

            // ตรวจสอบความถูกต้องของ Access Token
            const payload = await this.jwtService.verifyAsync(token);
            const userId = payload.sub;

            if (!userId) {
                this.logger.warn('Connection rejected: Invalid token payload');
                socket.disconnect();
                return;
            }

            // เก็บข้อมูลผู้ใช้ที่เชื่อมต่อสำเร็จ
            const existingSocketId = this.userToSocket.get(userId);
            if (existingSocketId) {
                this.server.sockets.sockets.get(existingSocketId)?.disconnect();
            }

            this.userToSocket.set(userId, socket.id);
            this.socketToUser.set(socket.id, userId);
            this.logger.log(`User connected: ${userId}`);

            // แจ้งให้ client ทั้งหมดทราบว่ามีผู้ใช้ออนไลน์
            this.server.emit('user_online', userId);

        } catch (error) {
            this.logger.error(`Token validation failed: ${error.message ?? 'Unknown error'}`);
            socket.disconnect();
        }
    }

    // ผู้ใช้ออกจากระบบ
    async handleDisconnect(socket: Socket): Promise<void> {
        const userId = this.socketToUser.get(socket.id);
        if (!userId) return;

        this.userToSocket.delete(userId);
        this.socketToUser.delete(socket.id);
        this.logger.log(`User disconnected: ${userId}`);
        this.server.emit('user_offline', userId);
    }

    // ดึงรายชื่อผู้ใช้ออนไลน์
    getOnlineUserIds(): Set<string> {
        return new Set(this.userToSocket.keys());
    }

    // บังคับตัดการเชื่อมต่อผู้ใช้
    disconnectUser(userId: string): void {
        const socketId = this.userToSocket.get(userId);

        if (!socketId) return;

        const socket = this.server.sockets.sockets.get(socketId);

        if (socket) {
            socket.disconnect(true);
        }

        this.userToSocket.delete(userId);
        this.socketToUser.delete(socketId);

        // this.logger.log(`User force disconnected: ${userId}`);
    }
}