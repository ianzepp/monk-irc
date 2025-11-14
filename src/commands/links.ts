/**
 * LINKS command handler - Server links (not implemented)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class LinksCommand extends BaseIrcCommand {
    readonly name = 'LINKS';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // LINKS not implemented - single server bridge, no server network
        this.sendReply(connection, IRC_REPLIES.RPL_LINKS, `${this.serverName} ${this.serverName} :0 monk-irc bridge (standalone)`);
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFLINKS, '* :End of /LINKS list');
    }
}
