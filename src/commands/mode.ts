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

        // Pure bridge - minimal mode support (no persistent modes)
        if (target.startsWith('#')) {
            // Channel mode - return default
            this.sendReply(connection, '324', `${target} +nt`);
        } else if (target === connection.nickname) {
            // User mode - return default
            this.sendReply(connection, '221', '+i');
        } else {
            this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND, 'MODE :Command not fully implemented');
        }
    }
}
