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

        // Get tenant and requesting user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        // Find the target user in the same tenant
        const targetUser = tenant.getUserByNickname(nickname);

        if (!targetUser) {
            this.sendNoSuchNick(connection, nickname);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFWHOIS, `${nickname} :End of WHOIS list`);
            return;
        }

        // Build and send WHOIS information using User class
        this.sendWhoisInfo(connection, targetUser, nickname);

        if (this.debug) {
            console.log(`🔍 [${connection.id}] WHOIS completed for ${nickname}`);
        }
    }

    /**
     * Send complete WHOIS information for a user
     */
    private sendWhoisInfo(connection: IrcConnection, targetUser: any, nickname: string): void {
        // RPL_WHOISUSER (311): "<nick> <user> <host> * :<real name>"
        this.sendReply(
            connection,
            IRC_REPLIES.RPL_WHOISUSER,
            `${targetUser.getNickname()} ${targetUser.getUsername()} ${targetUser.getHostname()} * :${targetUser.getRealname()}`
        );

        // RPL_WHOISCHANNELS (319): "<nick> :[prefix]<channel> [prefix]<channel> ..."
        // Show channels the user is in
        const channels = targetUser.getChannelNames();
        if (channels.length > 0) {
            this.sendReply(
                connection,
                '319',
                `${targetUser.getNickname()} :${channels.join(' ')}`
            );
        }

        // RPL_WHOISSERVER (312): "<nick> <server> :<server info>"
        this.sendReply(
            connection,
            '312',
            `${targetUser.getNickname()} ${this.serverName} :monk-irc server`
        );

        // RPL_WHOISIDLE (317): "<nick> <integer> <signon> :seconds idle, signon time"
        const idleSeconds = targetUser.getIdleSeconds();
        const signonTime = Math.floor(targetUser.getConnectedAt().getTime() / 1000);
        this.sendReply(
            connection,
            '317',
            `${targetUser.getNickname()} ${idleSeconds} ${signonTime} :seconds idle, signon time`
        );

        // RPL_AWAY (301): "<nick> :<away message>" - show if user is away
        if (targetUser.isAway()) {
            this.sendReply(
                connection,
                IRC_REPLIES.RPL_AWAY,
                `${targetUser.getNickname()} :${targetUser.getAwayMessage()}`
            );
        }

        // RPL_ENDOFWHOIS (318): "<nick> :End of WHOIS list"
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFWHOIS, `${nickname} :End of WHOIS list`);
    }
}
