/**
 * ISON command handler - Check if nicknames are online
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class IsonCommand extends BaseIrcCommand {
    readonly name = 'ISON';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: ISON <nickname> [<nickname> ...]
        const nicknames = args.trim().split(/\s+/);

        if (nicknames.length === 0 || !nicknames[0]) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'ISON :Not enough parameters');
            return;
        }

        // Check which nicknames are online
        const onlineNicks: string[] = [];

        for (const nick of nicknames) {
            const targetConnection = this.server.getConnectionByNickname(nick);
            if (targetConnection) {
                onlineNicks.push(nick);
            }
        }

        // Send reply with online nicknames
        this.sendReply(connection, IRC_REPLIES.RPL_ISON, `:${onlineNicks.join(' ')}`);

        if (this.debug) {
            console.log(`🔍 [${connection.id}] ISON check: ${onlineNicks.length}/${nicknames.length} online`);
        }
    }
}
