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
        const parsed = this.parseMessageCommand(connection, args, 'NOTICE');
        if (!parsed) return;

        const { target, message } = parsed;

        // Check if this is a tenant-aware connection sending to #channel@tenant
        if (connection.isTenantAware && target.includes('@')) {
            await this.handleTenantAwareNotice(connection, target, message);
            return;
        }

        // Get tenant and user objects
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const sender = tenant.getUserByConnection(connection);
        if (!sender) return;

        // Check if target is a channel
        if (target.startsWith('#')) {
            await this.handleChannelNotice(sender, tenant, target, message);
        } else {
            await this.handlePrivateNotice(sender, tenant, target, message);
        }
    }

    private async handleChannelNotice(
        sender: any,
        tenant: any,
        channelName: string,
        message: string
    ): Promise<void> {
        const channel = tenant.getChannel(channelName);

        if (!channel || !channel.hasMember(sender)) {
            // NOTICE should not send error replies - silently drop
            return;
        }

        // Broadcast notice to channel
        const userPrefix = sender.getUserPrefix();
        channel.broadcast(`:${userPrefix} NOTICE ${channelName} :${message}`, sender);

        if (this.debug) {
            console.log(`📢 [${sender.getConnection()?.id}] ${sender.getNickname()} -> ${channelName}: ${message}`);
        }
    }

    private async handlePrivateNotice(
        sender: any,
        tenant: any,
        targetNick: string,
        message: string
    ): Promise<void> {
        const targetUser = tenant.getUserByNickname(targetNick);

        if (!targetUser) {
            // NOTICE should not send error replies - silently drop
            return;
        }

        // Send notice to target user
        const userPrefix = sender.getUserPrefix();
        targetUser.sendMessage(`:${userPrefix} NOTICE ${targetNick} :${message}`);

        if (this.debug) {
            console.log(`📢 [${sender.getConnection()?.id}] ${sender.getNickname()} -> ${targetNick}: ${message}`);
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

        const channelName = target.substring(0, atIndex);
        const tenantName = target.substring(atIndex + 1);

        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            if (this.debug) {
                console.warn(`⚠️ [${connection.id}] Invalid channel name in tenant-aware NOTICE: ${channelName}`);
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

        // Get channel object
        const channel = tenant.getChannel(channelName);
        if (!channel) {
            if (this.debug) {
                console.log(`📢 [${connection.id}] No channel ${channelName} for tenant ${tenantName}`);
            }
            return;
        }

        // Send NOTICE to all members (without the @tenant tag)
        const userPrefix = this.getUserPrefix(connection);
        const noticeMessage = `:${userPrefix} NOTICE ${channelName} :${message}`;

        // Broadcast using Channel class
        channel.broadcast(noticeMessage);

        if (this.debug) {
            console.log(`📢 [${connection.id}] Sent tenant-aware NOTICE to ${channel.getMemberCount()} members in ${channelName}@${tenantName}`);
        }
    }
}
