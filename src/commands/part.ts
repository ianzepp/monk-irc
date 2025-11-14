/**
 * PART command handler - Leave a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class PartCommand extends BaseIrcCommand {
    readonly name = 'PART';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.trim().split(' ');
        const channelName = parts[0];

        // Validate channel name provided
        if (!channelName) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'PART :Not enough parameters');
            return;
        }

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const user = tenant.getUserByConnection(connection);
        if (!user) return;

        // Get channel
        const channel = tenant.getChannel(channelName);
        if (!channel) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Check if user is in the channel
        if (!channel.hasMember(user)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        if (this.debug) {
            console.log(`📍 [${connection.id}] ${user.getNickname()} leaving ${channelName}`);
        }

        // Build part message
        const partMessage = parts.slice(1).join(' ').replace(/^:/, '') || user.getNickname();

        // Broadcast PART to all channel members (including the parting user)
        const userPrefix = user.getUserPrefix();
        channel.broadcast(`:${userPrefix} PART ${channelName} :${partMessage}`);

        // Remove user from channel
        channel.removeMember(user);
        user.partChannel(channel);

        // Clean up empty channel
        if (channel.isEmpty()) {
            tenant.removeChannel(channelName);
        }

        if (this.debug) {
            console.log(`✅ [${connection.id}] ${user.getNickname()} left ${channelName}`);
        }
    }
}
