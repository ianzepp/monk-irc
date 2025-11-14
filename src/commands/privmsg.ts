/**
 * PRIVMSG command handler - Send message to channel or user
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class PrivmsgCommand extends BaseIrcCommand {
    readonly name = 'PRIVMSG';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse message command using helper
        const parsed = this.parseMessageCommand(connection, args, 'PRIVMSG');
        if (!parsed) return;

        const { target, message } = parsed;

        if (this.debug) {
            console.log(`💬 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
        }

        // Get tenant and user objects
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const sender = tenant.getUserByConnection(connection);
        if (!sender) return;

        // Check if target is a channel
        if (target.startsWith('#')) {
            await this.handleChannelMessage(sender, tenant, target, message);
        } else {
            await this.handlePrivateMessage(sender, tenant, target, message);
        }
    }

    private async handleChannelMessage(
        sender: any,
        tenant: any,
        channelName: string,
        message: string
    ): Promise<void> {
        const channel = tenant.getChannel(channelName);

        if (!channel) {
            const conn = sender.getConnection();
            if (conn) {
                this.sendReply(conn, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                    `${channelName} :No such channel`);
            }
            return;
        }

        // Check if sender is a member and has permission to send
        if (!channel.hasMember(sender)) {
            const conn = sender.getConnection();
            if (conn) {
                this.sendReply(conn, IRC_REPLIES.ERR_CANNOTSENDTOCHAN,
                    `${channelName} :Cannot send to channel (not a member)`);
            }
            return;
        }

        if (!channel.canSendMessage(sender)) {
            const conn = sender.getConnection();
            if (conn) {
                this.sendReply(conn, IRC_REPLIES.ERR_CANNOTSENDTOCHAN,
                    `${channelName} :Cannot send to channel (moderated)`);
            }
            return;
        }

        // Check for function invocation (! prefix)
        if (message.startsWith('!')) {
            await this.dispatchFunction(sender, channel, message);
            return;
        }

        // Broadcast message to channel (Channel class handles excluding sender)
        const userPrefix = sender.getUserPrefix();
        channel.broadcast(`:${userPrefix} PRIVMSG ${channelName} :${message}`, sender);

        // Forward to tenant-aware connections with tenant tag
        const senderConn = sender.getConnection();
        if (senderConn?.tenant) {
            this.forwardToTenantAware(senderConn, channelName, message);
        }
    }

    /**
     * Dispatch function invocation to registered function handler
     */
    private async dispatchFunction(
        sender: any,
        channel: any,
        message: string
    ): Promise<void> {
        const parts = message.substring(1).split(' ');
        const functionName = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (this.debug) {
            console.log(`⚡ [${sender.getNickname()}] Function: !${functionName} ${args.join(' ')}`);
        }

        const func = this.server.getFunction(functionName);
        if (!func) {
            sender.sendMessage(`:server NOTICE ${channel.getName()} :Unknown function: ${functionName} (try !help)`);
            return;
        }

        // Check if function requires schema channel
        if (func.requiresSchema && !channel.getSchemaName()) {
            sender.sendMessage(`:server NOTICE ${channel.getName()} :!${functionName} requires a schema channel`);
            return;
        }

        try {
            await func.executeFunction(sender, channel, args);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            sender.sendMessage(`:server NOTICE ${channel.getName()} :Function failed: ${message}`);

            if (this.debug) {
                console.error(`❌ Function error:`, error);
            }
        }
    }

    private async handlePrivateMessage(
        sender: any,
        tenant: any,
        targetNick: string,
        message: string
    ): Promise<void> {
        const targetUser = tenant.getUserByNickname(targetNick);

        if (!targetUser) {
            const conn = sender.getConnection();
            if (conn) {
                this.sendNoSuchNick(conn, targetNick);
            }
            return;
        }

        // Send message to target user
        const userPrefix = sender.getUserPrefix();
        targetUser.sendMessage(`:${userPrefix} PRIVMSG ${targetNick} :${message}`);
    }

    /**
     * Forward message to all tenant-aware connections with #channel@tenant format
     */
    private forwardToTenantAware(connection: IrcConnection, channel: string, message: string): void {
        const tenantAwareConnections = this.server.getTenantAwareConnections();

        if (tenantAwareConnections.length === 0) {
            return;
        }

        // Build message with tenant tag: :nick!user@tenant PRIVMSG #channel@tenant :message
        const userPrefix = `${connection.nickname}!${connection.username}@${connection.tenant}`;
        const targetWithTenant = `${channel}@${connection.tenant}`;
        const tenantAwareMessage = `:${userPrefix} PRIVMSG ${targetWithTenant} :${message}\r\n`;

        for (const tenantAwareConn of tenantAwareConnections) {
            tenantAwareConn.socket.write(tenantAwareMessage);
        }

        if (this.debug) {
            console.log(`🤖 Forwarded to ${tenantAwareConnections.length} tenant-aware connections: ${targetWithTenant}`);
        }
    }
}
