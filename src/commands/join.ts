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
            // Parse channel name: #users or #users/217e9dcc
            const parsed = this.parseChannelName(channelName);
            let schemaInfo = '';

            // Query schema or specific record data to verify access
            if (parsed) {
                const { schema, recordId } = parsed;

                try {
                    if (recordId) {
                        // Record-specific channel: GET /api/data/{schema}/{recordId}
                        const response = await this.apiRequest(connection, `/api/data/${schema}/${recordId}`);

                        if (response.ok) {
                            const result = await response.json() as { data?: any };
                            const record = result.data;

                            if (record) {
                                // Show record identifier (could be name, title, username, etc.)
                                const recordLabel = record.name || record.title || record.username || recordId;
                                schemaInfo = ` (record: ${recordLabel})`;

                                if (this.debug) {
                                    console.log(`📄 [${connection.id}] Record ${schema}/${recordId} found: ${recordLabel}`);
                                }
                            } else {
                                schemaInfo = ` (record: ${recordId})`;
                            }
                        } else if (response.status === 404) {
                            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                                `${channelName} :Record not found in schema '${schema}'`);
                            return;
                        } else if (response.status === 403) {
                            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                                `${channelName} :Access denied to record '${recordId}' in schema '${schema}'`);
                            return;
                        }
                    } else {
                        // Schema-level channel: GET /api/data/{schema}
                        const response = await this.apiRequest(connection, `/api/data/${schema}`);

                        if (response.ok) {
                            const data = await response.json() as { data?: any[] };
                            const count = data.data?.length || 0;
                            schemaInfo = ` (${count} records available)`;

                            if (this.debug) {
                                console.log(`📊 [${connection.id}] Schema ${schema} has ${count} records`);
                            }
                        } else if (response.status === 404) {
                            // Schema doesn't exist - still allow join (might be created later)
                            schemaInfo = ' (schema not found)';
                            if (this.debug) {
                                console.log(`⚠️  [${connection.id}] Schema ${schema} not found, but allowing join`);
                            }
                        } else if (response.status === 403) {
                            // User doesn't have access
                            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                                `${channelName} :Access denied to schema '${schema}'`);
                            return;
                        }
                    }
                } catch (error) {
                    // API error - log but allow join (maybe API is down temporarily)
                    console.error(`⚠️  API query failed for ${channelName}:`, error);
                    schemaInfo = ' (unable to query data)';
                }
            }

            // Pure bridge - in-memory only (no database persistence)
            // Add to in-memory channel membership
            this.server.addToChannel(connection, channelName);

            // Send JOIN message to user (extended format if they have the capability)
            const joinMessage = this.buildJoinMessage(connection, channelName, connection);
            this.sendMessage(connection, joinMessage);

            // Send topic - check for in-memory topic first, then fall back to schema/record info
            const tenant = this.server.getTenantForConnection(connection);
            const inMemoryTopic = tenant?.getChannelTopic(channelName);

            if (inMemoryTopic) {
                // In-memory topic takes precedence
                this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${inMemoryTopic}`);
            } else if (schemaInfo && parsed) {
                // Fall back to schema/record info
                const { schema, recordId } = parsed;
                if (recordId) {
                    this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :Record context: ${schema}/${recordId}${schemaInfo}`);
                } else {
                    this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :Schema context: ${schema}${schemaInfo}`);
                }
            } else {
                this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
            }

            // Get channel members and send names list
            const members = this.server.getChannelMembers(connection, channelName);
            const memberNicks = members.map((m: IrcConnection) => m.nickname).join(' ');

            this.sendReply(connection, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberNicks}`);
            this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);

            // Broadcast JOIN to other channel members with capability-aware formatting
            this.broadcastJoinToChannel(connection, channelName);

            if (this.debug) {
                console.log(`✅ [${connection.id}] ${connection.nickname} joined ${channelName}${schemaInfo}`);
            }

        } catch (error) {
            console.error(`❌ Failed to join channel ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :Cannot join channel`);
        }
    }

    /**
     * Build JOIN message with extended format if target has extended-join capability
     * Standard: :nick!user@host JOIN #channel
     * Extended: :nick!user@host JOIN #channel accountname :realname
     */
    private buildJoinMessage(joiningUser: IrcConnection, channelName: string, target: IrcConnection): string {
        const userPrefix = this.getUserPrefix(joiningUser);

        if (target.capabilities.has('extended-join')) {
            // Extended format includes account name and real name
            const accountName = joiningUser.username || '*';
            const realName = joiningUser.realname || 'Unknown';
            return `:${userPrefix} JOIN ${channelName} ${accountName} :${realName}`;
        } else {
            // Standard format
            return `:${userPrefix} JOIN ${channelName}`;
        }
    }

    /**
     * Broadcast JOIN to channel members with capability-aware formatting
     * Users with extended-join get extended format, others get standard format
     */
    private broadcastJoinToChannel(connection: IrcConnection, channelName: string): void {
        const members = this.server.getChannelMembers(connection, channelName);

        for (const member of members) {
            // Skip the joining user (already sent their own JOIN)
            if (member.id === connection.id) {
                continue;
            }

            // Send JOIN message in appropriate format based on member's capabilities
            const joinMessage = this.buildJoinMessage(connection, channelName, member);
            this.sendMessage(member, joinMessage);
        }
    }
}
