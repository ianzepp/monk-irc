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
        const channelName = args.split(' ')[0];

        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Check if user is in channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Pure bridge - topics are not persistent, always return "no topic"
        this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
    }
}
