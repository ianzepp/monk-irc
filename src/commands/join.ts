/**
 * JOIN command handler - Join a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class JoinCommand extends BaseIrcCommand {
    readonly name = 'JOIN';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const channelName = args.trim().split(' ')[0];

        // Validate channel name provided
        if (!channelName) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'JOIN :Not enough parameters');
            return;
        }

        // Validate channel name format
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        if (this.debug) {
            console.log(`📍 [${connection.id}] ${connection.nickname} joining ${channelName}`);
        }

        try {
            // Extract schema name from channel (#users → users)
            const schemaName = this.getSchemaFromChannel(channelName);
            let schemaInfo = '';

            // Query schema data to verify access and get count
            if (schemaName) {
                try {
                    const response = await this.apiRequest(connection, `/api/data/${schemaName}`);

                    if (response.ok) {
                        const data = await response.json() as { data?: any[] };
                        const count = data.data?.length || 0;
                        schemaInfo = ` (${count} records available)`;

                        if (this.debug) {
                            console.log(`📊 [${connection.id}] Schema ${schemaName} has ${count} records`);
                        }
                    } else if (response.status === 404) {
                        // Schema doesn't exist - still allow join (might be created later)
                        schemaInfo = ' (schema not found)';
                        if (this.debug) {
                            console.log(`⚠️  [${connection.id}] Schema ${schemaName} not found, but allowing join`);
                        }
                    } else if (response.status === 403) {
                        // User doesn't have access
                        this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                            `${channelName} :Access denied to schema '${schemaName}'`);
                        return;
                    }
                } catch (error) {
                    // API error - log but allow join (maybe API is down temporarily)
                    console.error(`⚠️  API query failed for ${schemaName}:`, error);
                    schemaInfo = ' (unable to query schema)';
                }
            }

            // Pure bridge - in-memory only (no database persistence)
            // Add to in-memory channel membership
            this.server.addToChannel(connection, channelName);

            // Send JOIN message to user
            this.sendMessage(connection, `:${this.getUserPrefix(connection)} JOIN ${channelName}`);

            // Send topic with schema info
            if (schemaInfo) {
                this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :Schema context: ${schemaName}${schemaInfo}`);
            } else {
                this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
            }

            // Get channel members and send names list
            const members = this.server.getChannelMembers(channelName);
            const memberNicks = members.map((m: IrcConnection) => m.nickname).join(' ');

            this.sendReply(connection, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberNicks}`);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);

            // Broadcast JOIN to other channel members
            this.server.broadcastToChannel(
                channelName,
                `:${this.getUserPrefix(connection)} JOIN ${channelName}`,
                connection
            );

            if (this.debug) {
                console.log(`✅ [${connection.id}] ${connection.nickname} joined ${channelName}${schemaInfo}`);
            }

        } catch (error) {
            console.error(`❌ Failed to join channel ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :Cannot join channel`);
        }
    }
}
