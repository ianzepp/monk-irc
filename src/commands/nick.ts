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
        // Registration is complete when we have both NICK and USER
        if (connection.nickname && connection.username && !connection.registered) {
            connection.registered = true;

            // Send welcome messages (001-004)
            this.sendReply(connection, IRC_REPLIES.RPL_WELCOME, `:Welcome to the IRC Network ${this.getUserPrefix(connection)}`);
            this.sendReply(connection, IRC_REPLIES.RPL_YOURHOST, `:Your host is ${this.serverName}, running monk-irc`);
            this.sendReply(connection, IRC_REPLIES.RPL_CREATED, `:This server was created recently`);
            this.sendReply(connection, IRC_REPLIES.RPL_MYINFO, `${this.serverName} monk-irc-0.1.0 o o`);

            if (this.debug) {
                console.log(`✅ [${connection.id}] Registration complete for ${connection.nickname}`);
            }

            // Persist user to database
            this.persistUser(connection).catch(err => {
                console.error(`❌ Failed to persist user ${connection.nickname}:`, err);
            });
        }
    }

    private async persistUser(connection: IrcConnection): Promise<void> {
        try {
            await this.apiClient.createUser({
                nickname: connection.nickname!,
                username: connection.username!,
                realname: connection.realname || 'Unknown',
                hostname: connection.hostname,
                modes: Array.from(connection.modes).join(''),
                registered_at: connection.connectedAt.toISOString(),
                last_seen: connection.lastActivity.toISOString()
            }, connection.jwtToken);

            if (this.debug) {
                console.log(`💾 [${connection.id}] User ${connection.nickname} persisted to database`);
            }
        } catch (error) {
            console.error(`❌ Failed to persist user:`, error);
        }
    }
}
