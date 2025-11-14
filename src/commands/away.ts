/**
 * AWAY command handler - Set/unset away status
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class AwayCommand extends BaseIrcCommand {
    readonly name = 'AWAY';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: AWAY [:<message>]
        const message = args.trim();

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const user = tenant.getUserByConnection(connection);
        if (!user) return;

        if (message.startsWith(':')) {
            // Set away with message
            const awayMessage = message.substring(1);
            user.setAway(awayMessage);
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(user, tenant);

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${user.getNickname()} is now away: ${awayMessage}`);
            }
        } else if (message.length > 0) {
            // Message without colon prefix
            user.setAway(message);
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(user, tenant);

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${user.getNickname()} is now away: ${message}`);
            }
        } else {
            // No message - unset away
            user.clearAway();
            this.sendReply(connection, IRC_REPLIES.RPL_UNAWAY, ':You are no longer marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(user, tenant);

            if (this.debug) {
                console.log(`👋 [${connection.id}] ${user.getNickname()} is back`);
            }
        }
    }

    /**
     * Broadcast AWAY status change to users with away-notify capability
     * who share channels with this user
     */
    private broadcastAwayStatus(user: any, tenant: any): void {
        const userPrefix = user.getUserPrefix();
        const awayMessage = user.getAwayMessage() || '';

        // Get all users in the same tenant
        const allUsers = tenant.getUsers();
        const notifiedUsers = new Set<string>();

        for (const targetUser of allUsers) {
            // Skip self, unregistered, or users without away-notify capability
            if (targetUser === user ||
                !targetUser.isRegistered() ||
                !targetUser.hasCapability('away-notify')) {
                continue;
            }

            // Check if they share any channels
            const sharedChannels = user.getSharedChannels(targetUser);

            if (sharedChannels.length > 0 && !notifiedUsers.has(targetUser.getId())) {
                // Send AWAY notification
                if (awayMessage) {
                    // User is now away
                    targetUser.sendMessage(`:${userPrefix} AWAY :${awayMessage}`);
                } else {
                    // User is no longer away
                    targetUser.sendMessage(`:${userPrefix} AWAY`);
                }
                notifiedUsers.add(targetUser.getId());

                if (this.debug) {
                    const conn = targetUser.getConnection();
                    console.log(`📢 [${conn?.id}] Notified ${targetUser.getNickname()} of ${user.getNickname()}'s away status`);
                }
            }
        }
    }
}
