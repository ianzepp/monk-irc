/**
 * JOIN command handler - Join a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';
import { ChannelMode } from '../lib/channel.js';

export class JoinCommand extends BaseIrcCommand {
    readonly name = 'JOIN';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.trim().split(' ');
        const channelName = parts[0];
        const key = parts[1]; // Optional channel key (+k mode)

        // Validate channel name provided
        if (!channelName) {
            this.sendNeedMoreParams(connection, 'JOIN');
            return;
        }

        // Validate channel name format
        if (!this.isValidChannelName(channelName)) {
            this.sendNoSuchChannel(connection, channelName);
            return;
        }

        if (this.debug) {
            console.log(`📍 [${connection.id}] ${connection.nickname} joining ${channelName}`);
        }

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const user = tenant.getUserByConnection(connection);
        if (!user) return;

        try {
            // Validate channel format and query schema/record info
            const parsed = this.parseChannelName(channelName);
            if (!parsed) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                    `${channelName} :Invalid channel format. Use #schema or #schema/recordId`);
                return;
            }

            // Query schema/record info for topic
            const schemaInfo = await this.fetchSchemaInfo(connection, channelName);

            // Get or create channel
            const channel = tenant.getOrCreateChannel(channelName, user.getNickname());

            // Check if user can join (key, invite-only, etc.)
            if (!channel.canJoin(user, key)) {
                if (channel.hasMode('k')) {
                    this.sendReply(connection, IRC_REPLIES.ERR_BADCHANNELKEY,
                        `${channelName} :Cannot join channel (+k) - bad key`);
                } else if (channel.hasMode('i')) {
                    this.sendReply(connection, IRC_REPLIES.ERR_INVITEONLYCHAN,
                        `${channelName} :Cannot join channel (+i)`);
                }
                return;
            }

            // Check if user is already in channel
            if (channel.hasMember(user)) {
                if (this.debug) {
                    console.log(`⚠️  [${connection.id}] ${user.getNickname()} already in ${channelName}`);
                }
                // User is already in channel - just send channel info (topic and names)
                this.sendTopic(connection, channel, schemaInfo);
                this.sendNames(connection, channel);
                return;
            }

            // Determine user's role based on their global access level
            const roles = this.getUserRolesFromAccessLevel(user, channel.isEmpty());

            // Add user to channel with appropriate roles
            channel.addMember(user, roles);
            user.joinChannel(channel);

            // Send JOIN message to user (extended format if they have the capability)
            const joinMessage = this.buildJoinMessage(user, channelName, user);
            user.sendMessage(joinMessage);

            // Send topic
            this.sendTopic(connection, channel, schemaInfo);

            // Send names list
            this.sendNames(connection, channel);

            // Broadcast JOIN to other channel members with capability-aware formatting
            this.broadcastJoin(channel, user);

            if (this.debug) {
                const roleList = Array.from(roles).join(', ') || 'none';
                console.log(`✅ [${connection.id}] ${user.getNickname()} joined ${channelName} (roles: ${roleList})${schemaInfo ? ' ' + schemaInfo : ''}`);
            }

        } catch (error) {
            // Error already reported to user in fetchSchemaInfo
            if (this.debug) {
                console.error(`❌ Failed to join channel ${channelName}:`, error);
            }
        }
    }

    /**
     * Determine user's channel roles based on their global access level
     * Maps API access levels to IRC channel modes:
     * - root/full → Operator (@)
     * - edit → Voice (+)
     * - read → Regular member (no prefix)
     */
    private getUserRolesFromAccessLevel(user: any, isFirstMember: boolean): Set<ChannelMode> {
        const roles = new Set<ChannelMode>();

        // First user in channel always gets operator (channel creator)
        if (isFirstMember) {
            roles.add(ChannelMode.OPERATOR);
            return roles;
        }

        // Map user's access level to channel roles
        const accessLevel = user.getAccessLevel();

        if (accessLevel === 'root' || accessLevel === 'full') {
            // Full access → Operator
            roles.add(ChannelMode.OPERATOR);
        } else if (accessLevel === 'edit') {
            // Edit access → Voice
            roles.add(ChannelMode.VOICE);
        }
        // read access → no special roles

        return roles;
    }

    /**
     * Fetch schema/record information for topic display
     */
    private async fetchSchemaInfo(connection: IrcConnection, channelName: string): Promise<string> {
        const parsed = this.parseChannelName(channelName);
        if (!parsed) return '';

        const { schema, recordId } = parsed;

        try {
            if (recordId) {
                // Record-specific channel: GET /api/data/{schema}/{recordId}
                const response = await this.apiRequest(connection, `/api/data/${schema}/${recordId}`);

                if (response.ok) {
                    const result = await response.json() as { data?: any };
                    const record = result.data;

                    if (record) {
                        const recordLabel = record.name || record.title || record.username || recordId;
                        return ` (record: ${recordLabel})`;
                    }
                    return ` (record: ${recordId})`;
                } else if (response.status === 404) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${channelName} :Record not found in schema '${schema}'`);
                    throw new Error('Record not found');
                } else if (response.status === 403) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${channelName} :Access denied to record '${recordId}' in schema '${schema}'`);
                    throw new Error('Access denied');
                }
            } else {
                // Schema-level channel: GET /api/data/{schema}
                const response = await this.apiRequest(connection, `/api/data/${schema}`);

                if (response.ok) {
                    const data = await response.json() as { data?: any[] };
                    const count = data.data?.length || 0;
                    return ` (${count} records available)`;
                } else if (response.status === 404) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${channelName} :Schema '${schema}' not found`);
                    throw new Error('Schema not found');
                } else if (response.status === 403) {
                    this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                        `${channelName} :Access denied to schema '${schema}'`);
                    throw new Error('Access denied');
                }
                // Other errors
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                    `${channelName} :Unable to verify schema '${schema}'`);
                throw new Error('Schema verification failed');
            }
        } catch (error) {
            if (error instanceof Error && (
                error.message === 'Record not found' ||
                error.message === 'Access denied' ||
                error.message === 'Schema not found' ||
                error.message === 'Schema verification failed'
            )) {
                throw error;
            }
            // API error - log and reject join
            console.error(`⚠️  API query failed for ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL,
                `${channelName} :Unable to verify channel with API`);
            throw new Error('API verification failed');
        }

        return '';
    }

    /**
     * Send topic to user
     */
    private sendTopic(connection: IrcConnection, channel: any, schemaInfo: string): void {
        const channelName = channel.getName();
        const topic = channel.getTopic();

        if (topic) {
            // In-memory topic takes precedence
            this.sendReply(connection, IRC_REPLIES.RPL_TOPIC, `${channelName} :${topic}`);
        } else if (schemaInfo) {
            // Fall back to schema/record info
            const parsed = this.parseChannelName(channelName);
            if (parsed) {
                const { schema, recordId } = parsed;
                if (recordId) {
                    this.sendReply(connection, IRC_REPLIES.RPL_TOPIC,
                        `${channelName} :Record context: ${schema}/${recordId}${schemaInfo}`);
                } else {
                    this.sendReply(connection, IRC_REPLIES.RPL_TOPIC,
                        `${channelName} :Schema context: ${schema}${schemaInfo}`);
                }
            }
        } else {
            this.sendReply(connection, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
        }
    }

    /**
     * Send names list to user
     */
    private sendNames(connection: IrcConnection, channel: any): void {
        const channelName = channel.getName();
        const memberList = channel.getMemberListWithRoles();

        this.sendReply(connection, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberList}`);
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);
    }

    /**
     * Broadcast JOIN to other channel members
     */
    private broadcastJoin(channel: any, joiningUser: any): void {
        const channelName = channel.getName();
        const members = channel.getMembers();

        for (const member of members) {
            // Skip the joining user (already sent their own JOIN)
            if (member === joiningUser) {
                continue;
            }

            // Send JOIN message in appropriate format based on member's capabilities
            const joinMessage = this.buildJoinMessage(joiningUser, channelName, member);
            member.sendMessage(joinMessage);
        }
    }

    /**
     * Build JOIN message with extended format if target has extended-join capability
     * Standard: :nick!user@host JOIN #channel
     * Extended: :nick!user@host JOIN #channel accountname :realname
     */
    private buildJoinMessage(joiningUser: any, channelName: string, targetUser: any): string {
        const userPrefix = joiningUser.getUserPrefix();

        if (targetUser.hasCapability('extended-join')) {
            // Extended format includes account name and real name
            const accountName = joiningUser.getUsername();
            const realName = joiningUser.getRealname();
            return `:${userPrefix} JOIN ${channelName} ${accountName} :${realName}`;
        } else {
            // Standard format
            return `:${userPrefix} JOIN ${channelName}`;
        }
    }
}
