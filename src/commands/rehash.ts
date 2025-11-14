/**
 * REHASH command handler - Reload configuration (not implemented)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class RehashCommand extends BaseIrcCommand {
    readonly name = 'REHASH';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // REHASH not implemented - restart server process instead
        this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
            ':REHASH command not supported - restart the server process to reload configuration');
    }
}
