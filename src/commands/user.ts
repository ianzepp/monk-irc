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

        // Check if username and tenant were already provided via NICK command
        const hasAuthFromNick = connection.username && connection.tenant && connection.jwt;

        if (hasAuthFromNick) {
            // Authentication already done via NICK command
            // Just extract realname from USER command (optional)
            const realname = args.includes(':')
                ? args.substring(args.indexOf(':') + 1)
                : 'Unknown';

            connection.realname = realname;

            // Update the existing User object with realname
            const tenant = this.server.getTenant(connection.tenant!);
            const user = tenant?.getUserByConnection(connection);
            if (user) {
                user.setRealname(realname);
            }

            if (this.debug) {
                console.log(`📝 [${connection.id}] USER command: using auth from NICK, realname="${realname}"`);
            }

            // Check if we should now complete registration
            this.checkRegistration(connection);
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
        const unused = parts[2];          // Unused parameter (standard IRC - usually * or 0)
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

        // Use configured API URL (single backend per monk-irc instance)
        const apiUrl = this.config.apiUrl;

        // Store connection info
        connection.username = username;
        connection.tenant = tenant;
        connection.apiUrl = apiUrl;
        connection.realname = realname;

        if (this.debug) {
            console.log(`📝 [${connection.id}] User info set: ${username}@${tenant} (${apiUrl})`);
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

        // Get or create tenant
        const tenant = this.server.getTenant(connection.tenant!);
        const isFirstConnection = tenant.getConnectionCount() === 0;

        // Create User object
        const { User } = await import('../lib/user.js');
        const user = new User(
            connection.username!,
            tenant,
            connection.nickname || connection.username!,
            connection.realname || connection.username!
        );

        // Set connection and authentication on user
        user.setConnection(connection);
        user.authenticate(jwt, connection.apiUrl!, this.serverName);

        // Add user to tenant
        tenant.addUser(user);

        if (this.debug) {
            console.log(`🏢 [${connection.id}] Registered with tenant: ${connection.tenant}`);
        }

        // Notify tenant-aware connections if this is the first user in the tenant
        if (isFirstConnection) {
            this.server.notifyTenantJoin(connection.tenant);
        }
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
