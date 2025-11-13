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

        // Parse USER command: USER <username> <tenant> <servername> :<realname>
        const parts = args.split(' ');
        if (parts.length < 4) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'USER :Not enough parameters');
            return;
        }

        const username = parts[0];        // API username
        const tenant = parts[1];          // API tenant
        const serverName = parts[2];      // API server identifier (dev/testing/prod)
        const realname = args.substring(args.indexOf(':') + 1) || 'Unknown';

        // Resolve API server URL
        const apiUrl = this.config.apiServers.get(serverName || this.config.defaultServer);
        if (!apiUrl) {
            this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND,
                `USER :Invalid server name '${serverName}'. Available: ${Array.from(this.config.apiServers.keys()).join(', ')}`);
            return;
        }

        // Store connection info
        connection.username = username;
        connection.tenant = tenant;
        connection.serverName = serverName;
        connection.apiUrl = apiUrl;
        connection.realname = realname;

        if (this.debug) {
            console.log(`📝 [${connection.id}] User info set: ${username}@${tenant} via ${serverName} (${apiUrl})`);
        }

        // Authenticate with monk-api
        try {
            await this.authenticateUser(connection);
        } catch (error) {
            console.error(`❌ Authentication failed for ${username}@${tenant}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND,
                `USER :Authentication failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        // Check if we should now complete registration
        this.checkRegistration(connection);
    }

    private async authenticateUser(connection: IrcConnection): Promise<void> {
        if (!connection.apiUrl || !connection.tenant || !connection.username) {
            throw new Error('Missing authentication parameters');
        }

        // Call POST /auth/login
        const response = await fetch(`${connection.apiUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tenant: connection.tenant,
                username: connection.username
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API returned ${response.status}: ${error}`);
        }

        const data = await response.json() as { jwt?: string; token?: string };
        const jwt = data.jwt || data.token;

        if (!jwt) {
            throw new Error('No JWT token in API response');
        }

        // Store JWT in connection
        connection.jwt = jwt;

        if (this.debug) {
            console.log(`✅ [${connection.id}] Authenticated ${connection.username}@${connection.tenant}`);
        }
    }

    private checkRegistration(connection: IrcConnection): void {
        // Registration is complete when we have both NICK, USER, and successful authentication
        if (connection.nickname && connection.username && connection.jwt && !connection.registered) {
            this.completeRegistration(connection).catch(err => {
                console.error(`❌ Failed to complete registration for ${connection.nickname}:`, err);
            });
        }
    }
}
