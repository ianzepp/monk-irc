/**
 * Open function - Open a record in its own channel
 * Forces the user into a record-specific channel (#schema/recordId)
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';
import { ChannelMode } from '../lib/channel.js';

export class OpenFunction extends BaseFunction {
    readonly name = 'open';
    readonly description = 'Open a record in its own channel';
    readonly usage = '!open <id>';
    readonly requiresSchema = true;

    constructor(config: ServerConfig, server: any) {
        super(config, server);
    }

    async executeFunction(sender: any, channel: any, args: string[]): Promise<void> {
        const schema = channel.getSchemaName();
        if (!schema) {
            this.sendNoticeToSender(sender, channel, 'This function requires a schema channel');
            return;
        }

        // Parse arguments
        const recordId = args[0];
        if (!recordId) {
            this.sendNoticeToSender(sender, channel, 'Usage: !open <id>');
            return;
        }

        // Build record channel name
        const recordChannelName = `#${schema}/${recordId}`;

        if (this.debug) {
            console.log(`🔓 [${sender.getNickname()}] !open ${recordId} -> ${recordChannelName}`);
        }

        try {
            const conn = sender.getConnection();

            // Validate record exists
            const response = await this.apiRequest(conn, `/api/data/${schema}/${recordId}`);

            if (response.status === 404) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `Failed to verify record: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any };
            const record = result.data;

            if (!record) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            // Get tenant
            const tenant = this.server.getTenantForConnection(conn);
            if (!tenant) {
                this.sendNoticeToSender(sender, channel, 'Failed to get tenant context');
                return;
            }

            // Get or create the record channel
            const recordChannel = tenant.getOrCreateChannel(recordChannelName, sender.getNickname());

            // Check if user is already in the channel
            if (recordChannel.hasMember(sender)) {
                this.sendNoticeToSender(sender, channel, `You are already in ${recordChannelName}`);
                return;
            }

            // Determine user's role based on their access level
            const roles = this.getUserRoles(sender, recordChannel);

            // Add user to channel
            recordChannel.addMember(sender, roles);
            sender.joinChannel(recordChannel);

            // Build record label for notification
            const recordLabel = record.name || record.title || record.username || recordId;

            // Send JOIN message to user
            const userPrefix = sender.getUserPrefix();
            sender.sendMessage(`:${userPrefix} JOIN ${recordChannelName}`);

            // Send topic with record info
            const topic = `Record: ${schema}/${recordId} (${recordLabel})`;
            sender.sendMessage(`:${this.server.config.serverName} 332 ${sender.getNickname()} ${recordChannelName} :${topic}`);

            // Send names list
            const memberList = recordChannel.getMemberListWithRoles();
            sender.sendMessage(`:${this.server.config.serverName} 353 ${sender.getNickname()} = ${recordChannelName} :${memberList}`);
            sender.sendMessage(`:${this.server.config.serverName} 366 ${sender.getNickname()} ${recordChannelName} :End of /NAMES list`);

            // Broadcast JOIN to other channel members
            this.broadcastJoin(recordChannel, sender);

            // Confirm in original channel
            this.sendNotice(channel, `${sender.getNickname()} opened ${recordChannelName}`);

            if (this.debug) {
                console.log(`✅ [${sender.getNickname()}] Opened ${recordChannelName}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ Open function error:`, error);
            }
        }
    }

    /**
     * Determine user's roles based on access level
     */
    private getUserRoles(user: any, channel: any): Set<ChannelMode> {
        const roles = new Set<ChannelMode>();

        // First user in channel gets operator
        if (channel.isEmpty()) {
            roles.add(ChannelMode.OPERATOR);
            return roles;
        }

        // Map user's access level to channel roles
        const accessLevel = user.getAccessLevel();

        if (accessLevel === 'root' || accessLevel === 'full') {
            roles.add(ChannelMode.OPERATOR);
        } else if (accessLevel === 'edit') {
            roles.add(ChannelMode.VOICE);
        }

        return roles;
    }

    /**
     * Broadcast JOIN to other channel members
     */
    private broadcastJoin(channel: any, joiningUser: any): void {
        const channelName = channel.getName();
        const userPrefix = joiningUser.getUserPrefix();
        const joinMessage = `:${userPrefix} JOIN ${channelName}`;

        for (const member of channel.getMembers()) {
            if (member !== joiningUser) {
                member.sendMessage(joinMessage);
            }
        }
    }
}
