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

        // Check if user is in channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Check if setting or getting topic
        const colonIndex = args.indexOf(':');

        if (colonIndex === -1) {
            // GET topic
            await this.getTopic(connection, channelName);
        } else {
            // SET topic
            const newTopic = args.substring(colonIndex + 1);
            await this.setTopic(connection, channelName, newTopic);
        }
    }

    /**
     * Get channel topic (in-memory)
     */
    private async getTopic(connection: IrcConnection, channelName: string): Promise<void> {
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) {
            this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
            return;
        }

        const topic = tenant.getChannelTopic(channelName);

        if (topic) {
            this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${topic}`);
        } else {
            this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
        }
    }

    /**
     * Set channel topic (in-memory only, not persisted to API)
     */
    private async setTopic(connection: IrcConnection, channelName: string, newTopic: string): Promise<void> {
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) {
            return;
        }

        // Store topic in-memory
        if (newTopic.trim().length === 0) {
            // Empty topic = clear topic
            tenant.clearChannelTopic(channelName);
        } else {
            tenant.setChannelTopic(channelName, newTopic);
        }

        // Broadcast topic change to all channel members
        const userPrefix = this.getUserPrefix(connection);
        const topicMessage = `:${userPrefix} TOPIC ${channelName} :${newTopic}`;

        this.server.broadcastToChannel(connection, channelName, topicMessage);

        if (this.debug) {
            console.log(`📝 [${connection.tenant}] ${connection.nickname} set topic for ${channelName}: ${newTopic}`);
        }
    }
}
