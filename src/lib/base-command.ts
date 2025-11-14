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

}
