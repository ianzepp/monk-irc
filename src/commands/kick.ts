/**
 * KICK command handler - Remove user from channel
 * Checks API permissions - user must have edit or full access to the schema
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class KickCommand extends BaseIrcCommand {
    readonly name = 'KICK';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: KICK <channel> <user> [:<reason>]
        const parts = args.split(' ');
        if (parts.length < 2) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'KICK :Not enough parameters');
            return;
        }

        const channelName = parts[0];
        const targetNick = parts[1];
        const reasonIndex = args.indexOf(':');
        const reason = reasonIndex > -1 ? args.substring(reasonIndex + 1) : `Kicked by ${connection.nickname}`;

        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Check if kicker is in the channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Find target user
        const targetConnection = this.server.getConnectionByNickname(targetNick);
        if (!targetConnection) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Check if target is in the channel
        if (!targetConnection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_USERNOTINCHANNEL, `${targetNick} ${channelName} :They aren't on that channel`);
            return;
        }

        // Check permissions via API (if channel maps to schema)
        const schemaName = this.getSchemaFromChannel(channelName);
        if (schemaName) {
            try {
                const hasPermission = await this.checkKickPermission(connection, schemaName);
                if (!hasPermission) {
                    this.sendReply(connection, IRC_REPLIES.ERR_CHANOPRIVSNEEDED,
                        `${channelName} :You don't have permission to kick users (requires edit or full access to ${schemaName})`);
                    return;
                }
            } catch (error) {
                console.error(`⚠️  Permission check failed for ${schemaName}:`, error);
                // Allow kick on API error (degraded mode)
            }
        }

        // Perform the kick
        this.server.removeFromChannel(targetConnection, channelName);

        // Broadcast KICK message to all channel members (including kicked user before they're removed from routing)
        const kickMsg = `:${this.getUserPrefix(connection)} KICK ${channelName} ${targetNick} :${reason}`;
        this.server.broadcastToChannel(connection, channelName, kickMsg);
        targetConnection.socket.write(`${kickMsg}\r\n`);

        if (this.debug) {
            console.log(`👢 [${connection.id}] ${connection.nickname} kicked ${targetNick} from ${channelName}: ${reason}`);
        }
    }

    /**
     * Check if user has permission to kick (edit or full access to schema)
     */
    private async checkKickPermission(connection: IrcConnection, schemaName: string): Promise<boolean> {
        try {
            // Try to describe the schema - this reveals permissions
            const response = await this.apiRequest(connection, `/api/describe/schema/${schemaName}`);

            if (!response.ok) {
                return false;
            }

            const result = await response.json() as {
                success?: boolean;
                data?: {
                    access?: string;
                    permissions?: { write?: boolean; delete?: boolean };
                };
            };

            // Check for root, edit, or full access
            const access = result.data?.access;
            const permissions = result.data?.permissions;

            // Root access always allowed
            if (access === 'root' || access === 'full' || access === 'edit') {
                return true;
            }

            // Check explicit permissions
            if (permissions?.write || permissions?.delete) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }
}
