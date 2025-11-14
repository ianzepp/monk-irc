/**
 * USERHOST command handler - Get user@host for nicknames
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class UserhostCommand extends BaseIrcCommand {
    readonly name = 'USERHOST';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const nicknames = args.trim().split(' ').filter(n => n.length > 0);

        if (nicknames.length === 0) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'USERHOST :Not enough parameters');
            return;
        }

        // Build USERHOST reply for each nickname
        const results: string[] = [];

        for (const nickname of nicknames) {
            const targetConnection = this.server.getConnectionByNickname(nickname);

            if (targetConnection && targetConnection.tenant === connection.tenant) {
                // User found in same tenant
                const awayFlag = targetConnection.awayMessage ? '-' : '+';
                const username = targetConnection.username || 'unknown';
                const hostname = targetConnection.hostname;

                // Format: nick=±user@host
                // + means not away, - means away
                results.push(`${nickname}=${awayFlag}${username}@${hostname}`);
            }
            // If not found or different tenant, skip (no error, just omit)
        }

        if (results.length > 0) {
            this.sendReply(connection, IRC_REPLIES.RPL_USERHOST, `:${results.join(' ')}`);
        } else {
            // No users found (all in different tenants or don't exist)
            this.sendReply(connection, IRC_REPLIES.RPL_USERHOST, ':');
        }
    }
}
