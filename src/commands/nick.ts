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
        const input = args.trim().split(' ')[0];

        // Validate input provided
        if (!input) {
            this.sendReply(connection, IRC_REPLIES.ERR_NONICKNAMEGIVEN, ':No nickname given');
            return;
        }

        // Parse the input format:
        // 1. alice!root@system → nick=alice, user=root, tenant=system
        // 2. root@system → nick=root, user=root, tenant=system
        // 3. alice → nick=alice (standard IRC, needs USER command)
        const parsed = this.parseNicknameInput(input);

        if (!parsed) {
            this.sendReply(connection, IRC_REPLIES.ERR_ERRONEUSNICKNAME, `${input} :Erroneous nickname format`);
            return;
        }

        const { nickname, username, tenant } = parsed;

        // Validate nickname format (must be valid IRC nickname)
        if (!this.isValidNickname(nickname)) {
            this.sendReply(connection, IRC_REPLIES.ERR_ERRONEUSNICKNAME, `${nickname} :Erroneous nickname`);
            return;
        }

        // Check if nickname is already in use
        if (!this.server.registerNickname(connection, nickname)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NICKNAMEINUSE, `${nickname} :Nickname is already in use`);
            return;
        }

        // Store username and tenant if provided via extended format
        if (username && tenant) {
            connection.username = username;
            connection.tenant = tenant;
            connection.apiUrl = this.config.apiUrl;

            if (this.debug) {
                console.log(`📝 [${connection.id}] Extended NICK format: nick=${nickname}, user=${username}, tenant=${tenant}`);
            }

            // Authenticate with monk-api immediately
            try {
                await this.authenticateUser(connection);
            } catch (error) {
                console.error(`❌ Authentication failed for ${username}@${tenant}:`, error);
                this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND,
                    `NICK :Authentication failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
                return;
            }
        }

        if (this.debug) {
            console.log(`📝 [${connection.id}] Nickname set to: ${nickname}`);
        }

        // If connection already registered, notify of nickname change
        if (connection.registered && connection.tenant) {
            const tenant = this.server.getTenant(connection.tenant);
            const user = tenant?.getUserByConnection(connection);

            if (user) {
                const oldPrefix = user.getUserPrefix();
                user.setNickname(nickname);
                connection.nickname = nickname;

                // Notify user of nick change
                this.sendMessage(connection, `:${oldPrefix} NICK ${nickname}`);

                // Broadcast nick change to all channels the user is in
                for (const channel of user.getChannels()) {
                    channel.broadcast(`:${oldPrefix} NICK ${nickname}`, user);
                }
            }
        }

        // Check if we should now complete registration
        this.checkRegistration(connection);
    }

    /**
     * Parse nickname input to extract nickname, username, and tenant
     * Supports three formats:
     * 1. alice!root@system → { nickname: 'alice', username: 'root', tenant: 'system' }
     * 2. root@system → { nickname: 'root', username: 'root', tenant: 'system' }
     * 3. alice → { nickname: 'alice', username: null, tenant: null }
     */
    private parseNicknameInput(input: string): { nickname: string; username: string | null; tenant: string | null } | null {
        // Check for full format: alice!root@system
        const exclamIndex = input.indexOf('!');
        const atIndex = input.indexOf('@');

        if (exclamIndex > 0 && atIndex > exclamIndex) {
            // Format: nick!user@tenant
            const nickname = input.substring(0, exclamIndex);
            const username = input.substring(exclamIndex + 1, atIndex);
            const tenant = input.substring(atIndex + 1);

            if (!nickname || !username || !tenant) {
                return null;
            }

            return { nickname, username, tenant };
        }

        if (atIndex > 0) {
            // Format: user@tenant (use username as nickname)
            const username = input.substring(0, atIndex);
            const tenant = input.substring(atIndex + 1);

            if (!username || !tenant) {
                return null;
            }

            return { nickname: username, username, tenant };
        }

        // Format: standard nickname only
        return { nickname: input, username: null, tenant: null };
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
            data?: { jwt?: string; token?: string; access?: string };
            jwt?: string;
            token?: string;
            access?: string;
        };

        // Handle both nested (data.token) and flat (token) response structures
        const jwt = result.data?.token || result.data?.jwt || result.jwt || result.token;
        const accessLevel = result.data?.access || result.access;

        if (!jwt) {
            throw new Error(`No JWT token in API response: ${JSON.stringify(result)}`);
        }

        // Store JWT in connection
        connection.jwt = jwt;

        if (this.debug) {
            console.log(`✅ [${connection.id}] Authenticated ${connection.username}@${connection.tenant}`);
        }

        // Get or create tenant
        const tenant = this.server.getTenant(connection.tenant);
        const isFirstConnection = tenant.getConnectionCount() === 0;

        // Create User object (import User class at top of file)
        const { User } = await import('../lib/user.js');
        const user = new User(
            connection.username!,
            tenant,
            connection.nickname!,
            connection.realname || connection.username!
        );

        // Set connection and authentication on user
        user.setConnection(connection);
        user.authenticate(jwt, connection.apiUrl!, this.serverName, accessLevel);

        // Add user to tenant
        tenant.addUser(user);

        if (this.debug) {
            const accessInfo = accessLevel ? ` (access: ${accessLevel})` : '';
            console.log(`🏢 [${connection.id}] Registered with tenant: ${connection.tenant}${accessInfo}`);
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
