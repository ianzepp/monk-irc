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
        const partMessage = parts.slice(1).join(' ').replace(/^:/, '') || connection.nickname!;

        // Validate channel name provided
        if (!channelName) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'PART :Not enough parameters');
            return;
        }

        // Check if user is in the channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        if (this.debug) {
            console.log(`📍 [${connection.id}] ${connection.nickname} leaving ${channelName}`);
        }

        // Broadcast PART to channel members (including self)
        this.server.broadcastToChannel(
            channelName,
            `:${this.getUserPrefix(connection)} PART ${channelName} :${partMessage}`
        );

        // Send PART message to user
        this.sendMessage(connection, `:${this.getUserPrefix(connection)} PART ${channelName} :${partMessage}`);

        // Remove from in-memory channel membership
        this.server.removeFromChannel(connection, channelName);

        // Pure bridge - no database persistence

        if (this.debug) {
            console.log(`✅ [${connection.id}] ${connection.nickname} left ${channelName}`);
        }
    }
}
