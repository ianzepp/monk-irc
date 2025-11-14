/**
 * Base class for IRC command handlers
 */

import type { IrcConnection, IrcCommandHandler, ServerConfig } from './types.js';
import { IRC_REPLIES } from './types.js';

export abstract class BaseIrcCommand implements IrcCommandHandler {
    protected debug: boolean;
    protected serverName: string;
    protected config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.debug = config.debug;
        this.serverName = config.serverName;
    }

    abstract readonly name: string;
    abstract readonly needsRegistration: boolean;

    abstract execute(connection: IrcConnection, args: string): Promise<void>;

    /**
     * Send IRC numeric reply
     * Format: :server.name CODE nickname message
     * With server-time: @time=2024-01-15T12:30:45.123Z :server.name CODE nickname message
     */
    protected sendReply(connection: IrcConnection, code: string, message: string): void {
        const nick = connection.nickname || '*';
        let response = `:${this.serverName} ${code} ${nick} ${message}`;

        // Prepend server-time tag if capability enabled
        if (connection.capabilities.has('server-time')) {
            const timestamp = new Date().toISOString();
            response = `@time=${timestamp} ${response}`;
        }

        response += '\r\n';
        connection.socket.write(response);
    }

    /**
     * Send raw IRC message
     * Format: prefix command params :trailing
     * With server-time: @time=2024-01-15T12:30:45.123Z prefix command params :trailing
     */
    protected sendMessage(connection: IrcConnection, message: string): void {
        let response = message;

        // Prepend server-time tag if capability enabled
        if (connection.capabilities.has('server-time')) {
            const timestamp = new Date().toISOString();
            response = `@time=${timestamp} ${response}`;
        }

        response += '\r\n';
        connection.socket.write(response);
    }

    /**
     * Build user prefix for messages
     * Format: nick!user@host
     */
    protected getUserPrefix(connection: IrcConnection): string {
        return `${connection.nickname}!${connection.username}@${connection.hostname}`;
    }

    /**
     * Validate nickname format (RFC 2812)
     * Must start with letter, contain letters/digits/special chars
     */
    protected isValidNickname(nickname: string): boolean {
        if (!nickname || nickname.length === 0 || nickname.length > 30) {
            return false;
        }

        // Must start with letter or special char
        const firstChar = /^[a-zA-Z\[\]\\`_^{|}]/;
        if (!firstChar.test(nickname[0])) {
            return false;
        }

        // Rest can be letters, digits, or special chars
        const validChars = /^[a-zA-Z0-9\[\]\\`_^{|}\-]*$/;
        return validChars.test(nickname.slice(1));
    }

    /**
     * Validate channel name format (RFC 2812)
     * Must start with # and contain valid characters
     * Supports both #schema and #schema/recordId formats
     */
    protected isValidChannelName(channel: string): boolean {
        if (!channel || channel.length < 2 || channel.length > 100) {
            return false;
        }

        if (!channel.startsWith('#')) {
            return false;
        }

        // Channel names can contain letters, digits, hyphens, underscores, and forward slash for record ID
        // Format: #schema or #schema/recordId
        const validChars = /^#[a-zA-Z0-9_\-]+(\/[a-zA-Z0-9_\-]+)?$/;
        return validChars.test(channel);
    }

    /**
     * Send MOTD (Message of the Day)
     */
    protected sendMotd(connection: IrcConnection): void {
        this.sendReply(connection, IRC_REPLIES.RPL_MOTDSTART, `:- ${this.serverName} Message of the day -`);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- Welcome to monk-irc bridge!`);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- `);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- This is a pure protocol bridge to monk-api.`);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- Authenticated as: ${connection.username}@${connection.tenant}`);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- API server: ${connection.serverName} (${connection.apiUrl})`);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- `);
        this.sendReply(connection, IRC_REPLIES.RPL_MOTD, `:- Enjoy your stay!`);
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFMOTD, `:End of /MOTD command.`);
    }

    /**
     * Send welcome messages and complete registration
     */
    protected async completeRegistration(connection: IrcConnection): Promise<void> {
        connection.registered = true;

        // Send welcome messages (001-004)
        this.sendReply(connection, IRC_REPLIES.RPL_WELCOME, `:Welcome to the IRC Network ${this.getUserPrefix(connection)}`);
        this.sendReply(connection, IRC_REPLIES.RPL_YOURHOST, `:Your host is ${this.serverName}, running monk-irc bridge`);
        this.sendReply(connection, IRC_REPLIES.RPL_CREATED, `:This server is a bridge to monk-api`);
        this.sendReply(connection, IRC_REPLIES.RPL_MYINFO, `${this.serverName} monk-irc-bridge-2.0.0 o o`);

        // Send MOTD
        this.sendMotd(connection);

        if (this.debug) {
            console.log(`✅ [${connection.id}] Registration complete for ${connection.nickname} (${connection.username}@${connection.tenant})`);
        }
    }

    /**
     * Make authenticated API request using connection's JWT
     */
    protected async apiRequest(connection: IrcConnection, path: string, options?: RequestInit): Promise<Response> {
        if (!connection.apiUrl || !connection.jwt) {
            throw new Error('Connection not authenticated');
        }

        const url = `${connection.apiUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${connection.jwt}`,
            'Content-Type': 'application/json',
            ...options?.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        return response;
    }

    /**
     * Extract schema name from channel name
     * #users → users
     * #tasks → tasks
     * #users/217e9dcc → users
     */
    protected getSchemaFromChannel(channelName: string): string | null {
        if (!channelName.startsWith('#')) {
            return null;
        }
        const withoutHash = channelName.substring(1);
        const slashIndex = withoutHash.indexOf('/');
        if (slashIndex > -1) {
            return withoutHash.substring(0, slashIndex);
        }
        return withoutHash;
    }

    /**
     * Parse channel name to extract schema and optional record ID
     * #users → { schema: 'users', recordId: null }
     * #users/217e9dcc → { schema: 'users', recordId: '217e9dcc' }
     */
    protected parseChannelName(channelName: string): { schema: string; recordId: string | null } | null {
        if (!channelName.startsWith('#')) {
            return null;
        }
        const withoutHash = channelName.substring(1);
        const slashIndex = withoutHash.indexOf('/');

        if (slashIndex > -1) {
            return {
                schema: withoutHash.substring(0, slashIndex),
                recordId: withoutHash.substring(slashIndex + 1)
            };
        }

        return {
            schema: withoutHash,
            recordId: null
        };
    }

    // ===== Helper Methods (from code review) =====

    /**
     * Send error with consistent formatting
     */
    protected sendError(
        connection: IrcConnection,
        errorCode: string,
        target: string,
        message: string
    ): void {
        this.sendReply(connection, errorCode, `${target} :${message}`);
    }

    /**
     * Send parameter error for a command
     */
    protected sendNeedMoreParams(connection: IrcConnection, command: string): void {
        this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS,
            `${command} :Not enough parameters`);
    }

    /**
     * Send "no such nick/channel" error
     */
    protected sendNoSuchNick(connection: IrcConnection, target: string): void {
        this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK,
            `${target} :No such nick/channel`);
    }

    /**
     * Send "no such channel" error
     */
    protected sendNoSuchChannel(connection: IrcConnection, channel: string): void {
        this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
            `${channel} :No such channel`);
    }

    /**
     * Send "not on channel" error
     */
    protected sendNotOnChannel(connection: IrcConnection, channel: string): void {
        this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL,
            `${channel} :You're not on that channel`);
    }

    /**
     * Parse message command arguments (PRIVMSG, NOTICE format)
     * Returns { target, message } or null if invalid
     */
    protected parseMessageCommand(
        connection: IrcConnection,
        args: string,
        commandName: string
    ): { target: string; message: string } | null {
        const spaceIndex = args.indexOf(' ');

        if (spaceIndex === -1) {
            this.sendReply(connection, IRC_REPLIES.ERR_NORECIPIENT,
                `:No recipient given (${commandName})`);
            return null;
        }

        const target = args.substring(0, spaceIndex);
        let message = args.substring(spaceIndex + 1);

        if (message.startsWith(':')) {
            message = message.substring(1);
        }

        if (!message) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTEXTTOSEND, ':No text to send');
            return null;
        }

        return { target, message };
    }

    /**
     * Parse colon-prefixed message from args
     * Example: "text before :message text" -> "message text"
     */
    protected parseColonMessage(args: string): string | null {
        const colonIndex = args.indexOf(':');
        if (colonIndex === -1) {
            return null;
        }
        return args.substring(colonIndex + 1);
    }

    /**
     * Parse space-separated arguments
     */
    protected parseArgs(args: string): string[] {
        return args.trim().split(/\s+/).filter(s => s.length > 0);
    }

    /**
     * Authenticate user with monk-api
     * Consolidates duplicate auth logic from nick.ts and user.ts
     */
    protected async authenticateWithApi(
        apiUrl: string,
        tenant: string,
        username: string
    ): Promise<string | null> {
        try {
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant, username })
            });

            if (!response.ok) {
                return null;
            }

            const result = await response.json() as {
                success?: boolean;
                data?: { jwt?: string; token?: string };
                jwt?: string;
                token?: string
            };

            const jwt = result.data?.token || result.data?.jwt || result.jwt || result.token;
            return jwt || null;
        } catch (error) {
            if (this.debug) {
                console.error('Authentication error:', error);
            }
            return null;
        }
    }

    /**
     * Handle common API response patterns and errors
     */
    protected async handleApiResponse<T>(
        connection: IrcConnection,
        response: Response,
        context: { channelName?: string; schemaName?: string }
    ): Promise<T | null> {
        if (!response.ok) {
            if (response.status === 404) {
                if (context.channelName) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${context.channelName} :Resource not found`);
                }
            } else if (response.status === 403) {
                if (context.channelName && context.schemaName) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${context.channelName} :Access denied to schema '${context.schemaName}'`);
                }
            }
            return null;
        }

        const result = await response.json() as { data?: T };
        return result.data || null;
    }

    /**
     * Check if user has permission level on schema
     */
    protected async checkSchemaPermission(
        connection: IrcConnection,
        schemaName: string,
        requiredLevel: 'read' | 'edit' | 'full' | 'root'
    ): Promise<boolean> {
        try {
            const response = await this.apiRequest(connection,
                `/api/describe/schema/${schemaName}`);

            if (!response.ok) {
                return false;
            }

            const result = await response.json() as {
                success?: boolean;
                data?: {
                    access?: string;
                    permissions?: { read?: boolean; write?: boolean; delete?: boolean };
                };
            };

            const access = result.data?.access;
            const permissions = result.data?.permissions;

            // Root always allowed
            if (access === 'root') return true;

            // Check level hierarchy
            switch (requiredLevel) {
                case 'root':
                    return access === 'root';
                case 'full':
                    return access === 'root' || access === 'full';
                case 'edit':
                    return access === 'root' || access === 'full' || access === 'edit' ||
                           !!permissions?.write || !!permissions?.delete;
                case 'read':
                    return access === 'root' || access === 'full' || access === 'edit' ||
                           access === 'read' || !!permissions?.read;
                default:
                    return false;
            }
        } catch (error) {
            if (this.debug) {
                console.error('Permission check error:', error);
            }
            return false;
        }
    }

    /**
     * Fetch schema list from API
     */
    protected async fetchSchemas(
        connection: IrcConnection
    ): Promise<Array<{ name: string; description?: string }>> {
        try {
            const response = await this.apiRequest(connection, '/api/data/schemas');

            if (!response.ok) {
                return [];
            }

            const result = await response.json() as {
                success?: boolean;
                data?: Array<{ name: string; description?: string; [key: string]: any }>;
            };

            return (result.data || []).map(schema => ({
                name: schema.name,
                description: schema.description
            }));
        } catch (error) {
            if (this.debug) {
                console.error('Error fetching schemas:', error);
            }
            return [];
        }
    }

}

