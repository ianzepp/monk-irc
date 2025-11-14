/**
 * MODE command handler - Get or set user/channel modes
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class ModeCommand extends BaseIrcCommand {
    readonly name = 'MODE';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.split(' ');
        const target = parts[0];

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const user = tenant.getUserByConnection(connection);
        if (!user) return;

        if (target.startsWith('#')) {
            // Channel mode - get from channel or return default
            const channel = tenant.getChannel(target);
            if (channel) {
                const modes = channel.getModes();
                this.sendReply(connection, '324', `${target} ${modes || '+nt'}`);
            } else {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${target} :No such channel`);
            }
        } else if (target === user.getNickname()) {
            // User mode - get from user or return default
            const modes = user.getModes();
            this.sendReply(connection, '221', modes || '+i');
        } else {
            this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND, 'MODE :Command not fully implemented');
        }
    }
}
