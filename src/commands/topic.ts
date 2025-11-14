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
        // Parse: TOPIC #channel [:new topic]
        const parts = args.trim().split(' ');
        const channelName = parts[0];

        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
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

        // Check if user is in channel
        if (!channel.hasMember(user)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Check if setting or getting topic
        const colonIndex = args.indexOf(':');

        if (colonIndex === -1) {
            // GET topic
            await this.getTopic(connection, channel);
        } else {
            // SET topic
            const newTopic = args.substring(colonIndex + 1);
            await this.setTopic(connection, user, channel, newTopic);
        }
    }

    /**
     * Get channel topic (in-memory)
     */
    private async getTopic(connection: IrcConnection, channel: any): Promise<void> {
        const topic = channel.getTopic();
        const channelName = channel.getName();

        if (topic) {
            this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${topic}`);
        } else {
            this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
        }
    }

    /**
     * Set channel topic (in-memory only, not persisted to API)
     */
    private async setTopic(connection: IrcConnection, user: any, channel: any, newTopic: string): Promise<void> {
        const channelName = channel.getName();

        // Check if user has permission to set topic
        if (!channel.canSetTopic(user)) {
            this.sendReply(connection, IRC_REPLIES.ERR_CHANOPRIVSNEEDED,
                `${channelName} :You're not a channel operator`);
            return;
        }

        // Store topic in-memory
        if (newTopic.trim().length === 0) {
            // Empty topic = clear topic
            channel.clearTopic();
        } else {
            channel.setTopic(newTopic, user.getUserPrefix());
        }

        // Broadcast topic change to all channel members
        const userPrefix = user.getUserPrefix();
        const topicMessage = `:${userPrefix} TOPIC ${channelName} :${newTopic}`;
        channel.broadcast(topicMessage);

        if (this.debug) {
            console.log(`📝 [${user.getTenantName()}] ${user.getNickname()} set topic for ${channelName}: ${newTopic}`);
        }
    }
}
