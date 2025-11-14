/**
 * ADMIN command handler - Administrative contact information
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class AdminCommand extends BaseIrcCommand {
    readonly name = 'ADMIN';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Send ADMIN replies with administrative contact info
        this.sendReply(connection, IRC_REPLIES.RPL_ADMINME, `${this.serverName} :Administrative info`);
        this.sendReply(connection, IRC_REPLIES.RPL_ADMINLOC1, ':monk-irc - IRC bridge to monk-api');
        this.sendReply(connection, IRC_REPLIES.RPL_ADMINLOC2, `:API Backend: ${connection.apiUrl || this.config.apiUrl}`);
        this.sendReply(connection, IRC_REPLIES.RPL_ADMINEMAIL, ':For support, contact your monk-api administrator');
    }
}
