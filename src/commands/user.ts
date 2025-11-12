/**
 * USER command handler - Set username and realname
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class UserCommand extends BaseIrcCommand {
    readonly name = 'USER';
    readonly needsRegistration = false;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Check if already registered
        if (connection.registered) {
            this.sendReply(connection, IRC_REPLIES.ERR_ALREADYREGISTERED, ':You may not reregister');
            return;
        }

        // Parse USER command: USER <username> <mode> <unused> :<realname>
        const parts = args.split(' ');
        if (parts.length < 4) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'USER :Not enough parameters');
            return;
        }

        const username = parts[0];
        const realname = args.substring(args.indexOf(':') + 1) || 'Unknown';

        connection.username = username;
        connection.realname = realname;

        if (this.debug) {
            console.log(`📝 [${connection.id}] User info set: ${username} (${realname})`);
        }

        // Check if we should now complete registration
        this.checkRegistration(connection);
    }

    private checkRegistration(connection: IrcConnection): void {
        // Registration is complete when we have both NICK and USER
        if (connection.nickname && connection.username && !connection.registered) {
            this.completeRegistration(connection).catch(err => {
                console.error(`❌ Failed to complete registration for ${connection.nickname}:`, err);
            });
        }
    }
}
