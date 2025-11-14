/**
 * KILL command handler - Disconnect users (not implemented)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class KillCommand extends BaseIrcCommand {
    readonly name = 'KILL';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // KILL not implemented - user disconnection handled via API permissions
        this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
            ':KILL command not supported - user access is managed through monk-api permissions');
    }
}
