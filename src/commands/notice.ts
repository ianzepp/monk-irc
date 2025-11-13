/**
 * NOTICE command handler - Send notice messages
 * Similar to PRIVMSG but for automated/system messages - should not trigger auto-replies
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class NoticeCommand extends BaseIrcCommand {
    readonly name = 'NOTICE';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: NOTICE <target> :<message>
        const colonIndex = args.indexOf(':');
        if (colonIndex === -1) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'NOTICE :Not enough parameters');
            return;
        }

        const target = args.substring(0, colonIndex).trim();
        const message = args.substring(colonIndex + 1);

        if (!target || !message) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'NOTICE :Not enough parameters');
            return;
        }

        // Check if target is a channel
        if (target.startsWith('#')) {
            // Channel notice
            if (!connection.channels.has(target)) {
                this.sendReply(connection, IRC_REPLIES.ERR_CANNOTSENDTOCHAN, `${target} :Cannot send to channel`);
                return;
            }

            // Broadcast notice to channel (excluding sender)
            this.server.broadcastToChannel(
                connection,
                target,
                `:${this.getUserPrefix(connection)} NOTICE ${target} :${message}`,
                connection
            );

            if (this.debug) {
                console.log(`📢 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
            }
        } else {
            // Private notice to user
            const targetConnection = this.server.getConnectionByNickname(target);

            if (!targetConnection) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${target} :No such nick/channel`);
                return;
            }

            targetConnection.socket.write(`:${this.getUserPrefix(connection)} NOTICE ${target} :${message}\r\n`);

            if (this.debug) {
                console.log(`📢 [${connection.id}] ${connection.nickname} -> ${target}: ${message}`);
            }
        }
    }
}
