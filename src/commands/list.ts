/**
 * LIST command handler - List all channels
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class ListCommand extends BaseIrcCommand {
    readonly name = 'LIST';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Pure bridge - list only currently active channels (in-memory)
        const channels = Array.from(this.server.getActiveChannels());

        for (const channelName of channels) {
            const memberCount = this.server.getChannelMembers(channelName).length;
            this.sendReply(connection, '322', `${channelName} ${memberCount} :Active channel`);
        }

        this.sendReply(connection, '323', ':End of /LIST');
    }
}
