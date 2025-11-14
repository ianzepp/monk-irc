/**
 * NICK command handler - Set or change nickname
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class NickCommand extends BaseIrcCommand {
    readonly name = 'NICK';
    readonly needsRegistration = false;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const nickname = args.trim().split(' ')[0];

        // Validate nickname provided
        if (!nickname) {
            this.sendReply(connection, IRC_REPLIES.ERR_NONICKNAMEGIVEN, ':No nickname given');
            return;
        }

        // Validate nickname format
        if (!this.isValidNickname(nickname)) {
            this.sendReply(connection, IRC_REPLIES.ERR_ERRONEUSNICKNAME, `${nickname} :Erroneous nickname`);
            return;
        }

        // Check if nickname is already in use
        if (!this.server.registerNickname(connection, nickname)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NICKNAMEINUSE, `${nickname} :Nickname is already in use`);
            return;
        }

        if (this.debug) {
            console.log(`📝 [${connection.id}] Nickname set to: ${nickname}`);
        }

        // If connection already registered, notify of nickname change
        if (connection.registered) {
            const oldPrefix = this.getUserPrefix(connection);
            connection.nickname = nickname;
            this.sendMessage(connection, `:${oldPrefix} NICK ${nickname}`);
        }

        // Check if we should now complete registration
        this.checkRegistration(connection);
    }

    private checkRegistration(connection: IrcConnection): void {
        // Block registration if CAP negotiating
        if (connection.capNegotiating) {
            return; // Wait for CAP END
        }

        // Registration is complete when we have NICK, USER, and successful authentication
        if (connection.nickname && connection.username && connection.jwt && !connection.registered) {
            this.completeRegistration(connection).catch(err => {
                console.error(`❌ Failed to complete registration for ${connection.nickname}:`, err);
            });
        }
    }
}
