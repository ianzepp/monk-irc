/**
 * NOTICE command handler - Send notice messages
 * Similar to PRIVMSG but for automated/system messages - should not trigger auto-replies
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class NoticeCommand extends BaseIrcCommand {
    readonly name = 'NOTICE';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: NOTICE <target> :<message>
        const colonIndex = args.indexOf(':');
        if (colonIndex === -1) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'NOTICE :Not enough parameters');
            return;
        }

        const target = args.substring(0, colonIndex).trim();
        const message = args.substring(colonIndex + 1);

        if (!target || !message) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'NOTICE :Not enough parameters');
            return;
        }

        // Check if this is a tenant-aware connection sending to #channel@tenant
        if (connection.isTenantAware && target.includes('@')) {
            await this.handleTenantAwareNotice(connection, target, message);
            return;
        }

        // Check if target is a channel
        if (target.startsWith('#')) {
            // Channel notice
            if (!connection.channels.has(target)) {
                this.sendReply(connection, IRC_REPLIES.ERR_CANNOTSENDTOCHAN, `${target} :Cannot send to channel`);
                return;
            }

            // Broadcast notice to channel (excluding sender)
            this.server.broadcastToChannel(
                connection,
                target,
                `:${this.getUserPrefix(connection)} NOTICE ${target} :${message}`,
                connection
            );

            if (this.debug) {
                console.log(`📢 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
            }
        } else {
            // Private notice to user
            const targetConnection = this.server.getConnectionByNickname(target);

            if (!targetConnection) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${target} :No such nick/channel`);
                return;
            }

            targetConnection.socket.write(`:${this.getUserPrefix(connection)} NOTICE ${target} :${message}\r\n`);

            if (this.debug) {
                console.log(`📢 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
            }
        }
    }

    /**
     * Handle NOTICE from tenant-aware connection with #channel@tenant format
     * Parse the tenant tag and route to the correct tenant's channel members
     */
    private async handleTenantAwareNotice(connection: IrcConnection, target: string, message: string): Promise<void> {
        // Parse #channel@tenant
        const atIndex = target.lastIndexOf('@');
        if (atIndex === -1 || !target.startsWith('#')) {
            if (this.debug) {
                console.warn(`⚠️ [${connection.id}] Invalid tenant-aware NOTICE format: ${target}`);
            }
            return; // Silently drop invalid format
        }

        const channel = target.substring(0, atIndex);
        const tenantName = target.substring(atIndex + 1);

        // Validate channel name
        if (!this.isValidChannelName(channel)) {
            if (this.debug) {
                console.warn(`⚠️ [${connection.id}] Invalid channel name in tenant-aware NOTICE: ${channel}`);
            }
            return; // Silently drop invalid channel
        }

        // Get the tenant
        const tenant = this.server.getTenant(tenantName);
        if (!tenant) {
            if (this.debug) {
                console.warn(`⚠️ [${connection.id}] Unknown tenant in NOTICE: ${tenantName}`);
            }
            return; // Silently drop unknown tenant
        }

        // Get channel members from this tenant
        const members = tenant.getChannelMembers(channel);

        if (members.length === 0) {
            if (this.debug) {
                console.log(`📢 [${connection.id}] No members in ${channel} for tenant ${tenantName}`);
            }
            return;
        }

        // Send NOTICE to all members (without the @tenant tag)
        const userPrefix = this.getUserPrefix(connection);
        const noticeMessage = `:${userPrefix} NOTICE ${channel} :${message}\r\n`;

        for (const member of members) {
            member.socket.write(noticeMessage);
        }

        if (this.debug) {
            console.log(`📢 [${connection.id}] Sent tenant-aware NOTICE to ${members.length} members in ${channel}@${tenantName}`);
        }
    }
}
