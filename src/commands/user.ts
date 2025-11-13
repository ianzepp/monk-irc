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

        // Parse USER command: USER <username@tenant> <mode> <servername> :<realname>
        const parts = args.split(' ');
        if (parts.length < 4) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'USER :Not enough parameters');
            return;
        }

        const userTenant = parts[0];      // username@tenant
        const mode = parts[1];            // Mode (ignored - usually 0 or *)
        const serverName = parts[2];      // API server identifier (dev/testing/prod)
        const realname = args.substring(args.indexOf(':') + 1) || 'Unknown';

        // Parse username@tenant
        const atIndex = userTenant.indexOf('@');
        if (atIndex === -1) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS,
                'USER :Username must be in format username@tenant (e.g., root@cli-test)');
            return;
        }

        const username = userTenant.substring(0, atIndex);
        const tenant = userTenant.substring(atIndex + 1);

        if (!username || !tenant) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS,
                'USER :Invalid username@tenant format');
            return;
        }

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

        const result = await response.json() as {
            success?: boolean;
            data?: { jwt?: string; token?: string };
            jwt?: string;
            token?: string
        };

        // Handle both nested (data.token) and flat (token) response structures
        const jwt = result.data?.token || result.data?.jwt || result.jwt || result.token;

        if (!jwt) {
            throw new Error(`No JWT token in API response: ${JSON.stringify(result)}`);
        }

        // Store JWT in connection
        connection.jwt = jwt;

        if (this.debug) {
            console.log(`✅ [${connection.id}] Authenticated ${connection.username}@${connection.tenant}`);
        }

        // Register connection with tenant
        const tenant = this.server.getTenant(connection.tenant);
        tenant.addConnection(connection);

        if (this.debug) {
            console.log(`🏢 [${connection.id}] Registered with tenant: ${connection.tenant}`);
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
