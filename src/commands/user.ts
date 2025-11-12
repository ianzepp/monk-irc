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
