/**
 * PRIVMSG command handler - Send message to channel or user
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class PrivmsgCommand extends BaseIrcCommand {
    readonly name = 'PRIVMSG';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: PRIVMSG <target> :<message>
        const spaceIndex = args.indexOf(' ');

        if (spaceIndex === -1) {
            this.sendReply(connection, IRC_REPLIES.ERR_NORECIPIENT, ':No recipient given (PRIVMSG)');
            return;
        }

        const target = args.substring(0, spaceIndex);
        let message = args.substring(spaceIndex + 1);

        // Remove leading colon if present
        if (message.startsWith(':')) {
            message = message.substring(1);
        }

        if (!message) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTEXTTOSEND, ':No text to send');
            return;
        }

        if (this.debug) {
            console.log(`💬 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
        }

        // Check if target is a channel
        if (target.startsWith('#')) {
            // Channel message
            if (!connection.channels.has(target)) {
                this.sendReply(connection, IRC_REPLIES.ERR_CANNOTSENDTOCHAN, `${target} :Cannot send to channel`);
                return;
            }

            // Broadcast message to channel (excluding sender)
            this.server.broadcastToChannel(
                target,
                `:${this.getUserPrefix(connection)} PRIVMSG ${target} :${message}`,
                connection
            );

            // Pure bridge - no message persistence

        } else {
            // Private message to user
            const targetConnection = this.server.getConnectionByNickname(target);

            if (!targetConnection) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${target} :No such nick/channel`);
                return;
            }

            // Send message to target user
            this.sendMessage(
                targetConnection,
                `:${this.getUserPrefix(connection)} PRIVMSG ${target} :${message}`
            );

            // Pure bridge - no message persistence
        }
    }
}
