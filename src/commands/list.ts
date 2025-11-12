/**
 * LIST command handler - List available channels
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class ListCommand extends BaseIrcCommand {
    readonly name = 'LIST';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, _args: string): Promise<void> {
        if (this.debug) {
            console.log(`📋 [${connection.id}] ${connection.nickname} requesting channel LIST`);
        }

        try {
            // Get all channels from database
            const channels = await this.apiClient.getAllChannels(this.apiToken);

            // Send RPL_LISTSTART (321)
            this.sendReply(connection, '321', 'Channel :Users  Name');

            // Send RPL_LIST (322) for each channel
            if (channels && channels.length > 0) {
                for (const channel of channels) {
                    // Get member count from in-memory state
                    const members = this.server.getChannelMembers(channel.name);
                    const memberCount = members.length;
                    const topic = channel.topic || '';

                    // Format: "322 nick #channel usercount :topic"
                    this.sendReply(connection, '322', `${channel.name} ${memberCount} :${topic}`);
                }
            }

            // Send RPL_LISTEND (323)
            this.sendReply(connection, '323', ':End of /LIST');

            if (this.debug) {
                console.log(`📋 [${connection.id}] Sent LIST with ${channels ? channels.length : 0} channels`);
            }
        } catch (error) {
            console.error(`❌ Failed to get channel list:`, error);
            this.sendReply(connection, '323', ':End of /LIST');
        }
    }
}
