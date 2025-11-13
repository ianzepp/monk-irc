/**
 * NAMES command handler - List users in a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class NamesCommand extends BaseIrcCommand {
    readonly name = 'NAMES';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const channelName = args.trim().split(' ')[0];

        if (!channelName) {
            // No channel specified - this is allowed but we'll just return empty for now
            return;
        }

        // Validate channel name format
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        if (this.debug) {
            console.log(`📋 [${connection.id}] ${connection.nickname} requesting NAMES for ${channelName}`);
        }

        // Get channel members from in-memory state
        const members = this.server.getChannelMembers(connection, channelName);
        
        if (members.length === 0) {
            // Channel doesn't exist or has no members
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);
            return;
        }

        // Build names list
        const memberNicks = members.map((m: IrcConnection) => m.nickname).join(' ');

        // Send RPL_NAMREPLY (353) - Format: "= #channel :nick1 nick2 nick3"
        // The "=" indicates a public channel
        this.sendReply(connection, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberNicks}`);
        
        // Send RPL_ENDOFNAMES (366)
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);

        if (this.debug) {
            console.log(`📋 [${connection.id}] NAMES for ${channelName}: ${memberNicks}`);
        }
    }
}
