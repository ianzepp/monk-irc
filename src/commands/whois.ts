/**
 * WHOIS command handler - Detailed user information
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class WhoisCommand extends BaseIrcCommand {
    readonly name = 'WHOIS';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const nickname = args.trim().split(' ')[0];

        if (!nickname) {
            this.sendReply(connection, IRC_REPLIES.ERR_NONICKNAMEGIVEN, ':No nickname given');
            return;
        }

        if (this.debug) {
            console.log(`🔍 [${connection.id}] ${connection.nickname} requesting WHOIS for ${nickname}`);
        }

        // Find the user
        const targetConnection = this.server.getConnectionByNickname(nickname);

        if (!targetConnection) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${nickname} :No such nick/channel`);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFWHOIS, `${nickname} :End of WHOIS list`);
            return;
        }

        // Check if target is in the same tenant (tenant isolation)
        if (targetConnection.tenant !== connection.tenant) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${nickname} :No such nick/channel`);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFWHOIS, `${nickname} :End of WHOIS list`);
            return;
        }

        // RPL_WHOISUSER (311): "<nick> <user> <host> * :<real name>"
        this.sendReply(
            connection,
            IRC_REPLIES.RPL_WHOISUSER,
            `${targetConnection.nickname} ${targetConnection.username || '~user'} ${targetConnection.hostname} * :${targetConnection.realname || 'Unknown'}`
        );

        // RPL_WHOISCHANNELS (319): "<nick> :[prefix]<channel> [prefix]<channel> ..."
        // Show channels the user is in
        if (targetConnection.channels.size > 0) {
            const channels = Array.from(targetConnection.channels).join(' ');
            this.sendReply(
                connection,
                '319',
                `${targetConnection.nickname} :${channels}`
            );
        }

        // RPL_WHOISSERVER (312): "<nick> <server> :<server info>"
        this.sendReply(
            connection,
            '312',
            `${targetConnection.nickname} ${this.serverName} :monk-irc server`
        );

        // RPL_WHOISIDLE (317): "<nick> <integer> :seconds idle"
        const idleSeconds = Math.floor((Date.now() - targetConnection.lastActivity.getTime()) / 1000);
        this.sendReply(
            connection,
            '317',
            `${targetConnection.nickname} ${idleSeconds} ${Math.floor(targetConnection.connectedAt.getTime() / 1000)} :seconds idle, signon time`
        );

        // RPL_AWAY (301): "<nick> :<away message>" - show if user is away
        if (targetConnection.awayMessage) {
            this.sendReply(
                connection,
                IRC_REPLIES.RPL_AWAY,
                `${targetConnection.nickname} :${targetConnection.awayMessage}`
            );
        }

        // RPL_ENDOFWHOIS (318): "<nick> :End of WHOIS list"
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFWHOIS, `${nickname} :End of WHOIS list`);

        if (this.debug) {
            console.log(`🔍 [${connection.id}] WHOIS completed for ${nickname}`);
        }
    }
}
