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

        if (message.startsWith(':')) {
            // Set away with message
            connection.awayMessage = message.substring(1);
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(connection);

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${connection.nickname} is now away: ${connection.awayMessage}`);
            }
        } else if (message.length > 0) {
            // Message without colon prefix
            connection.awayMessage = message;
            this.sendReply(connection, IRC_REPLIES.RPL_NOWAWAY, ':You have been marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(connection);

            if (this.debug) {
                console.log(`😴 [${connection.id}] ${connection.nickname} is now away: ${connection.awayMessage}`);
            }
        } else {
            // No message - unset away
            connection.awayMessage = undefined;
            this.sendReply(connection, IRC_REPLIES.RPL_UNAWAY, ':You are no longer marked as being away');

            // Broadcast to users with away-notify capability
            this.broadcastAwayStatus(connection);

            if (this.debug) {
                console.log(`👋 [${connection.id}] ${connection.nickname} is back`);
            }
        }
    }

    /**
     * Broadcast AWAY status change to users with away-notify capability
     * who share channels with this user
     */
    private broadcastAwayStatus(connection: IrcConnection): void {
        if (!this.server) return;

        const userPrefix = this.getUserPrefix(connection);
        const awayMessage = connection.awayMessage || '';

        // Get all connections in the same tenant who share channels
        const connections = this.server.getConnections() as IrcConnection[];
        const notifiedUsers = new Set<string>();

        for (const targetConn of connections) {
            // Skip self, unregistered, or users without away-notify capability
            if (targetConn.id === connection.id ||
                !targetConn.registered ||
                !targetConn.capabilities.has('away-notify')) {
                continue;
            }

            // Skip if different tenant (tenant isolation)
            if (targetConn.tenant !== connection.tenant) {
                continue;
            }

            // Check if they share any channels
            const sharedChannels = Array.from(connection.channels).filter(ch =>
                targetConn.channels.has(ch)
            );

            if (sharedChannels.length > 0 && !notifiedUsers.has(targetConn.id)) {
                // Send AWAY notification
                if (awayMessage) {
                    // User is now away
                    this.sendMessage(targetConn, `:${userPrefix} AWAY :${awayMessage}`);
                } else {
                    // User is no longer away
                    this.sendMessage(targetConn, `:${userPrefix} AWAY`);
                }
                notifiedUsers.add(targetConn.id);

                if (this.debug) {
                    console.log(`📢 [${targetConn.id}] Notified ${targetConn.nickname} of ${connection.nickname}'s away status`);
                }
            }
        }
    }
}
