/**
 * WALLOPS command handler - Operator messages (not implemented)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class WallopsCommand extends BaseIrcCommand {
    readonly name = 'WALLOPS';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // WALLOPS not implemented - no operator concept in stateless bridge
        this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
            ':WALLOPS command not supported - monk-irc has no operator privileges');
    }
}
