/**
 * TOPIC command handler - Get or set channel topic
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class TopicCommand extends BaseIrcCommand {
    readonly name = 'TOPIC';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.trim().split(' ');
        const channelName = parts[0];

        if (!channelName) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'TOPIC :Not enough parameters');
            return;
        }

        // Validate channel name format
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Check if user is in the channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        try {
            // Get channel from database
            const channels = await this.apiClient.findChannelByName(channelName, this.apiToken);
            if (!channels || channels.length === 0) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
                return;
            }

            const channel = channels[0];

            // Check if we're setting or getting the topic
            const topicStart = args.indexOf(':');
            if (topicStart !== -1) {
                // Setting topic
                const newTopic = args.substring(topicStart + 1).trim();
                
                await this.apiClient.updateChannel(channel.id, {
                    topic: newTopic,
                    topic_set_by: connection.nickname!,
                    topic_set_at: new Date().toISOString()
                }, this.apiToken);

                // Broadcast topic change to all channel members
                this.server.broadcastToChannel(
                    channelName,
                    `:${this.getUserPrefix(connection)} TOPIC ${channelName} :${newTopic}`
                );

                if (this.debug) {
                    console.log(`📝 [${connection.id}] ${connection.nickname} set topic for ${channelName}: ${newTopic}`);
                }
            } else {
                // Getting topic
                if (channel.topic) {
                    this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${channel.topic}`);
                } else {
                    this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to get/set topic for ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :Cannot get/set topic`);
        }
    }
}
