/**
 * WALLOPS command handler - Broadcast message to all users in tenant
 * Requires root or full access level
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class WallopsCommand extends BaseIrcCommand {
    readonly name = 'WALLOPS';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const message = args.startsWith(':') ? args.substring(1) : args;

        if (!message) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'WALLOPS :Not enough parameters');
            return;
        }

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const sender = tenant.getUserByConnection(connection);
        if (!sender) return;

        // Check if user has permission to use WALLOPS (root or full access)
        const accessLevel = sender.getAccessLevel();
        if (accessLevel !== 'root' && accessLevel !== 'full') {
            this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
                ':Permission denied - WALLOPS requires root or full access');
            return;
        }

        if (this.debug) {
            console.log(`📢 [${connection.id}] ${sender.getNickname()} broadcasting WALLOPS: ${message}`);
        }

        // Broadcast WALLOPS to all users in the tenant
        const senderPrefix = sender.getUserPrefix();
        const wallopsMessage = `:${senderPrefix} WALLOPS :${message}`;

        const users = tenant.getUsers();
        let sentCount = 0;

        for (const user of users) {
            // Send to all registered users (including sender)
            if (user.isRegistered()) {
                user.sendMessage(wallopsMessage);
                sentCount++;
            }
        }

        if (this.debug) {
            console.log(`📢 [${connection.id}] WALLOPS sent to ${sentCount} users in tenant ${tenant.getName()}`);
        }
    }
}
