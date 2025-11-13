/**
 * AWAY command handler - Set/unset away status
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class AwayCommand extends BaseIrcCommand {
    readonly name = 'AWAY';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: AWAY [:<message>]
        const message = args.trim();

        if (message.startsWith(':')) {
            // Set away with message
            connection.awayMessage = message.substring(1);
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${connection.nickname} is now away: ${connection.awayMessage}`);
            }
        } else if (message.length > 0) {
            // Message without colon prefix
            connection.awayMessage = message;
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${connection.nickname} is now away: ${connection.awayMessage}`);
            }
        } else {
            // No message - unset away
            connection.awayMessage = undefined;
            this.sendReply(connection, IRC_REPLIES.RPL_UNAWAY, ':You are no longer marked as being away');

            if (this.debug) {
                console.log(`👋 [${connection.id}] ${connection.nickname} is back`);
            }
        }
    }
}
