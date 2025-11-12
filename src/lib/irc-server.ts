/**
 * Core IRC Server with Command Dispatch
 *
 * Manages IRC connections and dispatches commands to individual handlers
 */

import * as net from 'net';
import * as crypto from 'crypto';
import type { IrcConnection, IrcCommandHandler, ServerConfig } from './types.js';
import { IRC_REPLIES } from './types.js';

export class IrcServer {
    private server: net.Server;
    private connections = new Map<string, IrcConnection>();
    private nicknameToConnection = new Map<string, IrcConnection>();
    private channelMembers = new Map<string, Set<IrcConnection>>();
    private commandHandlers = new Map<string, IrcCommandHandler>();

    constructor(private config: ServerConfig) {
        this.server = net.createServer(this.handleConnection.bind(this));
    }

    async start(): Promise<void> {
        // Load command handlers first
        await this.loadCommandHandlers();

        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`🚀 IRC server listening on ${this.config.host}:${this.config.port}`);
                console.log(`💬 Connect with: irssi -c ${this.config.host} -p ${this.config.port}`);
                console.log(`🔗 API endpoint: ${this.config.apiUrl}`);
                console.log(`🏷️  Server name: ${this.config.serverName}`);
                resolve();
            });

            this.server.on('error', reject);
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            // Close all connections
            for (const connection of this.connections.values()) {
                this.closeConnection(connection);
            }

            this.server.close(() => {
                console.log('✅ IRC server stopped');
                resolve();
            });
        });
    }

    private async loadCommandHandlers(): Promise<void> {
        // Load command handlers
        try {
            const { NickCommand } = await import('../commands/nick.js');
            const { UserCommand } = await import('../commands/user.js');
            const { PingCommand } = await import('../commands/ping.js');
            const { QuitCommand } = await import('../commands/quit.js');

            // Register commands (pass server instance for methods like registerNickname)
            this.registerCommand(new NickCommand(this.config, this));
            this.registerCommand(new UserCommand(this.config, this));
            this.registerCommand(new PingCommand(this.config));
            this.registerCommand(new QuitCommand(this.config));

            if (this.config.debug) {
                console.log(`📋 Command handlers loaded: ${this.commandHandlers.size}`);
            }
        } catch (error) {
            console.error('❌ Failed to load command handlers:', error);
            throw error;
        }
    }

    private registerCommand(handler: IrcCommandHandler): void {
        this.commandHandlers.set(handler.name.toUpperCase(), handler);
        if (this.config.debug) {
            console.log(`✅ Registered command: ${handler.name}`);
        }
    }

    private handleConnection(socket: net.Socket): void {
        const connection: IrcConnection = {
            socket,
            id: crypto.randomUUID(),
            hostname: socket.remoteAddress || 'unknown',
            registered: false,
            authenticated: false,
            channels: new Set(),
            modes: new Set(),
            connectedAt: new Date(),
            lastActivity: new Date()
        };

        this.connections.set(connection.id, connection);

        if (this.config.debug) {
            console.log(`📥 New connection: ${connection.id} from ${connection.hostname}`);
        }

        // Send server notice
        socket.write(`:${this.config.serverName} NOTICE AUTH :*** Looking up your hostname...\r\n`);
        socket.write(`:${this.config.serverName} NOTICE AUTH :*** Found your hostname\r\n`);

        socket.on('data', (data) => this.handleData(connection, data));
        socket.on('close', () => this.handleClose(connection));
        socket.on('error', (err) => this.handleError(connection, err));
    }

    private async handleData(connection: IrcConnection, data: Buffer): Promise<void> {
        connection.lastActivity = new Date();

        const lines = data.toString().split(/\r?\n/);

        for (const line of lines) {
            if (!line.trim()) continue;

            if (this.config.debug) {
                console.log(`📨 [${connection.id}] ${line}`);
            }

            // Parse IRC message: [prefix] command [params]
            const parts = line.trim().split(' ');
            const command = parts[0].toUpperCase();
            const args = parts.slice(1).join(' ');

            const handler = this.commandHandlers.get(command);

            if (!handler) {
                this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND, `${command} :Unknown command`);
                continue;
            }

            if (handler.needsRegistration && !connection.registered) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOTREGISTERED, ':You have not registered');
                continue;
            }

            try {
                await handler.execute(connection, args);
            } catch (error) {
                console.error(`❌ Error executing ${command}:`, error);
                this.sendReply(connection, '400', ':Internal server error');
            }
        }
    }

    private handleClose(connection: IrcConnection): void {
        if (this.config.debug) {
            console.log(`📤 Connection closed: ${connection.id}`);
        }

        // Remove from nickname mapping
        if (connection.nickname) {
            this.nicknameToConnection.delete(connection.nickname);
        }

        // Remove from all channels
        for (const channel of connection.channels) {
            const members = this.channelMembers.get(channel);
            if (members) {
                members.delete(connection);
            }
        }

        // Remove connection
        this.connections.delete(connection.id);
    }

    private handleError(connection: IrcConnection, error: Error): void {
        console.error(`❌ Connection error [${connection.id}]:`, error);
        this.closeConnection(connection);
    }

    private closeConnection(connection: IrcConnection): void {
        try {
            connection.socket.end();
        } catch (error) {
            // Ignore errors on close
        }
    }

    private sendReply(connection: IrcConnection, code: string, message: string): void {
        const nick = connection.nickname || '*';
        const response = `:${this.config.serverName} ${code} ${nick} ${message}\r\n`;
        connection.socket.write(response);
    }

    // Public methods for command handlers to use

    public getConnectionByNickname(nickname: string): IrcConnection | undefined {
        return this.nicknameToConnection.get(nickname);
    }

    public registerNickname(connection: IrcConnection, nickname: string): boolean {
        // Check if nickname is already in use
        if (this.nicknameToConnection.has(nickname)) {
            return false;
        }

        // Remove old nickname if exists
        if (connection.nickname) {
            this.nicknameToConnection.delete(connection.nickname);
        }

        // Register new nickname
        connection.nickname = nickname;
        this.nicknameToConnection.set(nickname, connection);
        return true;
    }

    public broadcastToChannel(channelName: string, message: string, excludeConnection?: IrcConnection): void {
        const members = this.channelMembers.get(channelName);
        if (!members) return;

        for (const member of members) {
            if (member !== excludeConnection) {
                member.socket.write(`${message}\r\n`);
            }
        }
    }

    public addToChannel(connection: IrcConnection, channelName: string): void {
        if (!this.channelMembers.has(channelName)) {
            this.channelMembers.set(channelName, new Set());
        }

        const members = this.channelMembers.get(channelName)!;
        members.add(connection);
        connection.channels.add(channelName);
    }

    public removeFromChannel(connection: IrcConnection, channelName: string): void {
        const members = this.channelMembers.get(channelName);
        if (members) {
            members.delete(connection);
            if (members.size === 0) {
                this.channelMembers.delete(channelName);
            }
        }

        connection.channels.delete(channelName);
    }

    public getChannelMembers(channelName: string): IrcConnection[] {
        const members = this.channelMembers.get(channelName);
        return members ? Array.from(members) : [];
    }
}
