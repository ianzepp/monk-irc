/**
 * Core IRC Server with Command Dispatch and Tenant Isolation
 *
 * Manages IRC connections and dispatches commands to individual handlers.
 * Provides complete tenant isolation using Tenant instances.
 */

import * as net from 'net';
import * as crypto from 'crypto';
import type { IrcConnection, IrcCommandHandler, ServerConfig } from './types.js';
import { IRC_REPLIES } from './types.js';
import { Tenant } from './tenant.js';
import { FunctionRegistry } from '../functions/function-registry.js';

export class IrcServer {
    private server: net.Server;
    private connections = new Map<string, IrcConnection>();
    private nicknameToConnection = new Map<string, IrcConnection>();
    private tenants = new Map<string, Tenant>();
    private commandHandlers = new Map<string, IrcCommandHandler>();
    private tenantAwareConnections = new Set<IrcConnection>();
    private functionRegistry = new FunctionRegistry();

    constructor(private config: ServerConfig) {
        this.server = net.createServer(this.handleConnection.bind(this));
    }

    async start(): Promise<void> {
        // Load command handlers and functions
        await this.loadCommandHandlers();
        await this.loadFunctions();

        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`🚀 IRC server listening on ${this.config.host}:${this.config.port}`);
                console.log(`💬 Connect with: irssi -c ${this.config.host} -p ${this.config.port}`);
                console.log(`🔗 API backend: ${this.config.apiUrl}`);
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
            const { CapCommand } = await import('../commands/cap.js');
            const { NickCommand } = await import('../commands/nick.js');
            const { UserCommand } = await import('../commands/user.js');
            const { PingCommand } = await import('../commands/ping.js');
            const { QuitCommand } = await import('../commands/quit.js');
            const { JoinCommand } = await import('../commands/join.js');
            const { PartCommand } = await import('../commands/part.js');
            const { PrivmsgCommand } = await import('../commands/privmsg.js');
            const { NoticeCommand } = await import('../commands/notice.js');
            const { NamesCommand } = await import('../commands/names.js');
            const { TopicCommand } = await import('../commands/topic.js');
            const { ListCommand } = await import('../commands/list.js');
            const { WhoCommand } = await import('../commands/who.js');
            const { WhoisCommand } = await import('../commands/whois.js');
            const { ModeCommand } = await import('../commands/mode.js');
            const { KickCommand } = await import('../commands/kick.js');
            const { InviteCommand } = await import('../commands/invite.js');
            const { AwayCommand } = await import('../commands/away.js');
            const { IsonCommand } = await import('../commands/ison.js');
            const { VersionCommand } = await import('../commands/version.js');
            const { MotdCommand } = await import('../commands/motd.js');
            const { HelpCommand } = await import('../commands/help.js');
            const { InfoCommand } = await import('../commands/info.js');
            const { UserhostCommand } = await import('../commands/userhost.js');
            const { TimeCommand } = await import('../commands/time.js');
            const { StatsCommand } = await import('../commands/stats.js');
            const { AdminCommand } = await import('../commands/admin.js');
            const { OperCommand } = await import('../commands/oper.js');
            const { KillCommand } = await import('../commands/kill.js');
            const { RehashCommand } = await import('../commands/rehash.js');
            const { WallopsCommand } = await import('../commands/wallops.js');
            const { LinksCommand } = await import('../commands/links.js');
            const { ForcejoinCommand } = await import('../commands/forcejoin.js');
            const { ForcepartCommand } = await import('../commands/forcepart.js');

            // Register commands (pass server instance for methods like registerNickname, channel management)
            this.registerCommand(new CapCommand(this.config, this));
            this.registerCommand(new NickCommand(this.config, this));
            this.registerCommand(new UserCommand(this.config, this));
            this.registerCommand(new PingCommand(this.config));
            this.registerCommand(new QuitCommand(this.config, this));
            this.registerCommand(new JoinCommand(this.config, this));
            this.registerCommand(new PartCommand(this.config, this));
            this.registerCommand(new PrivmsgCommand(this.config, this));
            this.registerCommand(new NoticeCommand(this.config, this));
            this.registerCommand(new NamesCommand(this.config, this));
            this.registerCommand(new TopicCommand(this.config, this));
            this.registerCommand(new ListCommand(this.config, this));
            this.registerCommand(new WhoCommand(this.config, this));
            this.registerCommand(new WhoisCommand(this.config, this));
            this.registerCommand(new ModeCommand(this.config, this));
            this.registerCommand(new KickCommand(this.config, this));
            this.registerCommand(new InviteCommand(this.config, this));
            this.registerCommand(new AwayCommand(this.config, this));
            this.registerCommand(new IsonCommand(this.config, this));
            this.registerCommand(new VersionCommand(this.config));
            this.registerCommand(new MotdCommand(this.config));
            this.registerCommand(new HelpCommand(this.config));
            this.registerCommand(new InfoCommand(this.config));
            this.registerCommand(new UserhostCommand(this.config, this));
            this.registerCommand(new TimeCommand(this.config));
            this.registerCommand(new StatsCommand(this.config, this));
            this.registerCommand(new AdminCommand(this.config));
            this.registerCommand(new OperCommand(this.config));
            this.registerCommand(new KillCommand(this.config));
            this.registerCommand(new RehashCommand(this.config));
            this.registerCommand(new WallopsCommand(this.config, this));
            this.registerCommand(new LinksCommand(this.config));
            this.registerCommand(new ForcejoinCommand(this.config, this));
            this.registerCommand(new ForcepartCommand(this.config, this));

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

    private async loadFunctions(): Promise<void> {
        // Load in-channel functions (!commands)
        try {
            const { HelpFunction } = await import('../functions/help.js');
            const { FindFunction } = await import('../functions/find.js');
            const { CountFunction } = await import('../functions/count.js');
            const { GetFunction } = await import('../functions/get.js');
            const { ShowFunction } = await import('../functions/show.js');
            const { OpenFunction } = await import('../functions/open.js');
            const { ListFunction } = await import('../functions/list.js');

            // Register functions
            this.functionRegistry.register(new HelpFunction(this.config, this));
            this.functionRegistry.register(new FindFunction(this.config, this));
            this.functionRegistry.register(new CountFunction(this.config, this));
            this.functionRegistry.register(new GetFunction(this.config, this));
            this.functionRegistry.register(new ShowFunction(this.config, this));
            this.functionRegistry.register(new OpenFunction(this.config, this));
            this.functionRegistry.register(new ListFunction(this.config, this));

            if (this.config.debug) {
                console.log(`⚡ Functions loaded: ${this.functionRegistry.getAll().length}`);
            }
        } catch (error) {
            console.error('❌ Failed to load functions:', error);
            throw error;
        }
    }

    getFunction(name: string): any {
        return this.functionRegistry.get(name);
    }

    getFunctionRegistry(): FunctionRegistry {
        return this.functionRegistry;
    }

    private handleConnection(socket: net.Socket): void {
        const connection: IrcConnection = {
            socket,
            id: crypto.randomUUID(),
            hostname: socket.remoteAddress || 'unknown',
            registered: false,
            channels: new Set(),
            modes: new Set(),
            connectedAt: new Date(),
            lastActivity: new Date(),
            lineBuffer: '',
            capNegotiating: false,
            capabilities: new Set(),
            isTenantAware: false
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

        // Add to line buffer
        connection.lineBuffer += data.toString();

        // Split by CRLF or LF
        const lines = connection.lineBuffer.split(/\r?\n/);

        // Keep the last incomplete line in the buffer
        connection.lineBuffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;

            if (this.config.debug) {
                console.log(`📨 [${connection.id}] ${line}`);
            }

            // Parse IRC message: [prefix] command [params] [:trailing]
            const parsed = this.parseIrcMessage(line);
            if (!parsed) continue;

            const { command, args } = parsed;
            const handler = this.commandHandlers.get(command);

            if (!handler) {
                this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND, `${command} :Unknown command`);
                continue;
            }

            if (handler.needsRegistration && !connection.registered) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOTREGISTERED, ':You have not registered');
                continue;
            }

            // Execute command asynchronously without blocking the message loop
            // This allows multiple commands to be processed in parallel
            handler.execute(connection, args).catch((error) => {
                console.error(`❌ Error executing ${command}:`, error);
                this.sendReply(connection, '400', ':Internal server error');
            });
        }
    }

    /**
     * Parse IRC message format: [prefix] command [params] [:trailing]
     * Returns command and args (params + trailing as one string)
     */
    private parseIrcMessage(line: string): { command: string; args: string } | null {
        let message = line.trim();
        if (!message) return null;

        // Skip prefix if present (we don't need it for server-side parsing)
        if (message.startsWith(':')) {
            const spaceIdx = message.indexOf(' ');
            if (spaceIdx === -1) return null;
            message = message.substring(spaceIdx + 1).trim();
        }

        // Extract command (first word)
        const spaceIdx = message.indexOf(' ');
        if (spaceIdx === -1) {
            // Command with no args
            return { command: message.toUpperCase(), args: '' };
        }

        const command = message.substring(0, spaceIdx).toUpperCase();
        const args = message.substring(spaceIdx + 1);

        return { command, args };
    }

    private handleClose(connection: IrcConnection): void {
        if (this.config.debug) {
            console.log(`📤 Connection closed: ${connection.id}`);
        }

        // Broadcast QUIT to all channels if user was registered
        if (connection.nickname && connection.tenant) {
            const tenant = this.getTenant(connection.tenant);
            const quitMsg = `:${connection.nickname}!${connection.username || 'unknown'}@${connection.hostname} QUIT :Connection closed`;

            for (const channelName of connection.channels) {
                tenant.broadcastToChannel(channelName, quitMsg, connection);
            }
        }

        // Remove from tenant
        if (connection.tenant) {
            const tenant = this.getTenant(connection.tenant);
            const isLastConnection = tenant.getConnectionCount() === 1;

            tenant.removeConnection(connection);

            if (this.config.debug) {
                console.log(`🏢 [${connection.tenant}] Connection removed from tenant`);
            }

            // Notify tenant-aware connections if this was the last user in the tenant
            if (isLastConnection) {
                this.notifyTenantPart(connection.tenant);
            }
        }

        // Pure bridge - no database cleanup needed (in-memory only)

        // Remove from tenant-aware connections if applicable
        if (connection.isTenantAware) {
            this.removeTenantAwareConnection(connection);
        }

        // Remove from nickname mapping
        if (connection.nickname) {
            this.nicknameToConnection.delete(connection.nickname);
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

    // Tenant management methods

    /**
     * Get or create tenant instance
     */
    public getTenant(tenantName: string): Tenant {
        if (!this.tenants.has(tenantName)) {
            const tenant = new Tenant(tenantName);
            this.tenants.set(tenantName, tenant);

            if (this.config.debug) {
                console.log(`🏢 Created new tenant: ${tenantName}`);
            }
        }

        return this.tenants.get(tenantName)!;
    }

    /**
     * Get tenant for a connection (requires connection to be authenticated)
     */
    public getTenantForConnection(connection: IrcConnection): Tenant | null {
        if (!connection.tenant) {
            return null;
        }
        return this.getTenant(connection.tenant);
    }

    /**
     * List all active tenants
     */
    public getActiveTenants(): Tenant[] {
        return Array.from(this.tenants.values());
    }

    // Channel management methods (tenant-aware)

    public broadcastToChannel(
        connection: IrcConnection,
        channelName: string,
        message: string,
        excludeConnection?: IrcConnection
    ): void {
        const tenant = this.getTenantForConnection(connection);
        if (!tenant) {
            console.error('❌ Cannot broadcast: connection has no tenant');
            return;
        }

        tenant.broadcastToChannel(channelName, message, excludeConnection);
    }

    public addToChannel(connection: IrcConnection, channelName: string): void {
        const tenant = this.getTenantForConnection(connection);
        if (!tenant) {
            console.error('❌ Cannot add to channel: connection has no tenant');
            return;
        }

        tenant.addToChannel(connection, channelName);

        if (this.config.debug) {
            console.log(`📍 [${connection.tenant}] ${connection.nickname} added to ${channelName}`);
        }
    }

    public removeFromChannel(connection: IrcConnection, channelName: string): void {
        const tenant = this.getTenantForConnection(connection);
        if (!tenant) {
            console.error('❌ Cannot remove from channel: connection has no tenant');
            return;
        }

        tenant.removeFromChannel(connection, channelName);

        if (this.config.debug) {
            console.log(`📍 [${connection.tenant}] ${connection.nickname} removed from ${channelName}`);
        }
    }

    public getChannelMembers(connection: IrcConnection, channelName: string): IrcConnection[] {
        const tenant = this.getTenantForConnection(connection);
        if (!tenant) {
            return [];
        }

        return tenant.getChannelMembers(channelName);
    }

    public getActiveChannels(connection: IrcConnection): Set<string> {
        const tenant = this.getTenantForConnection(connection);
        if (!tenant) {
            return new Set();
        }

        return tenant.getActiveChannels();
    }

    // Tenant-aware connection management

    public addTenantAwareConnection(connection: IrcConnection): void {
        this.tenantAwareConnections.add(connection);

        if (this.config.debug) {
            console.log(`🤖 [${connection.id}] Added to tenant-aware connections`);
        }
    }

    public removeTenantAwareConnection(connection: IrcConnection): void {
        this.tenantAwareConnections.delete(connection);

        if (this.config.debug) {
            console.log(`🤖 [${connection.id}] Removed from tenant-aware connections`);
        }
    }

    public getTenantAwareConnections(): IrcConnection[] {
        return Array.from(this.tenantAwareConnections);
    }

    /**
     * Notify all tenant-aware connections when a tenant's first user connects
     */
    public notifyTenantJoin(tenantName: string): void {
        for (const tenantAwareConn of this.tenantAwareConnections) {
            const nick = tenantAwareConn.nickname || '*';
            tenantAwareConn.socket.write(`:${this.config.serverName} ${IRC_REPLIES.TENANTJOIN} ${nick} :${tenantName}\r\n`);
        }

        if (this.config.debug && this.tenantAwareConnections.size > 0) {
            console.log(`🤖 Sent TENANTJOIN for ${tenantName} to ${this.tenantAwareConnections.size} tenant-aware connections`);
        }
    }

    /**
     * Notify all tenant-aware connections when a tenant's last user disconnects
     */
    public notifyTenantPart(tenantName: string): void {
        for (const tenantAwareConn of this.tenantAwareConnections) {
            const nick = tenantAwareConn.nickname || '*';
            tenantAwareConn.socket.write(`:${this.config.serverName} ${IRC_REPLIES.TENANTPART} ${nick} :${tenantName}\r\n`);
        }

        if (this.config.debug && this.tenantAwareConnections.size > 0) {
            console.log(`🤖 Sent TENANTPART for ${tenantName} to ${this.tenantAwareConnections.size} tenant-aware connections`);
        }
    }

    // Admin/monitoring methods

    public getServerStats() {
        return {
            totalConnections: this.connections.size,
            totalTenants: this.tenants.size,
            tenants: this.getActiveTenants().map(t => t.getStats())
        };
    }
}
