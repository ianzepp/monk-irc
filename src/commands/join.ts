/**
 * JOIN command handler - Join a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class JoinCommand extends BaseIrcCommand {
    readonly name = 'JOIN';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const channelName = args.trim().split(' ')[0];

        // Validate channel name provided
        if (!channelName) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'JOIN :Not enough parameters');
            return;
        }

        // Validate channel name format
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        if (this.debug) {
            console.log(`📍 [${connection.id}] ${connection.nickname} joining ${channelName}`);
        }

        try {
            // Get or create channel in database
            const channel = await this.apiClient.getOrCreateChannel(channelName, this.apiToken);

            if (this.debug) {
                console.log(`💾 [${connection.id}] Channel ${channelName} retrieved/created: ${channel.id}`);
            }

            // Add to in-memory channel membership
            this.server.addToChannel(connection, channelName);

            // Send JOIN message to user
            this.sendMessage(connection, `:${this.getUserPrefix(connection)} JOIN ${channelName}`);

            // Send topic if exists
            if (channel.topic) {
                this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${channel.topic}`);
            } else {
                this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
            }

            // Get channel members and send names list
            const members = this.server.getChannelMembers(channelName);
            const memberNicks = members.map((m: IrcConnection) => m.nickname).join(' ');

            this.sendReply(connection, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberNicks}`);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);

            // Broadcast JOIN to other channel members
            this.server.broadcastToChannel(
                channelName,
                `:${this.getUserPrefix(connection)} JOIN ${channelName}`,
                connection
            );

            // Persist channel membership to database
            if (connection.userId) {
                this.persistChannelMembership(channel.id, connection).catch(err => {
                    console.error(`❌ Failed to persist channel membership:`, err);
                });
            }

            if (this.debug) {
                console.log(`✅ [${connection.id}] ${connection.nickname} joined ${channelName}`);
            }

        } catch (error) {
            console.error(`❌ Failed to join channel ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :Cannot join channel`);
        }
    }

    private async persistChannelMembership(channelId: string, connection: IrcConnection): Promise<void> {
        try {
            await this.apiClient.joinChannel(
                channelId,
                connection.userId!,
                connection.nickname!,
                this.apiToken
            );

            if (this.debug) {
                console.log(`💾 [${connection.id}] Channel membership persisted for ${connection.nickname}`);
            }
        } catch (error) {
            console.error(`❌ Failed to persist channel membership:`, error);
        }
    }
}
