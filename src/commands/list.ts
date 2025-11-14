/**
 * LIST command handler - List all channels (queries monk-api for schemas)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class ListCommand extends BaseIrcCommand {
    readonly name = 'LIST';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Start of LIST
        this.sendReply(connection, IRC_REPLIES.RPL_LISTSTART, 'Channel :Users  Name');

        try {
            // Query monk-api for available schemas
            const schemas = await this.fetchSchemas(connection);

            if (schemas && schemas.length > 0) {
                // List each schema as a channel
                for (const schema of schemas) {
                    const channelName = `#${schema.name}`;
                    const memberCount = this.server.getChannelMembers(connection, channelName).length;
                    const topic = schema.description || `Schema: ${schema.name}`;

                    // Format: 322 <nick> <channel> <usercount> :<topic>
                    this.sendReply(connection, IRC_REPLIES.RPL_LIST, `${channelName} ${memberCount} :${topic}`);
                }
            } else {
                if (this.debug) {
                    console.log(`📋 [${connection.id}] No schemas found or API returned empty list`);
                }
            }

            // Also list any active record-specific channels (#schema/recordId)
            const activeChannels = Array.from(this.server.getActiveChannels(connection)) as string[];
            for (const channelName of activeChannels) {
                // Only show record-specific channels (with /)
                if (channelName.includes('/')) {
                    const memberCount = this.server.getChannelMembers(connection, channelName).length;
                    this.sendReply(connection, IRC_REPLIES.RPL_LIST, `${channelName} ${memberCount} :Record-specific channel`);
                }
            }

        } catch (error) {
            console.error(`❌ Failed to fetch schemas for LIST:`, error);

            // Fallback to showing only active channels
            if (this.debug) {
                console.log(`📋 [${connection.id}] Falling back to active channels only`);
            }

            const activeChannels = Array.from(this.server.getActiveChannels(connection)) as string[];
            for (const channelName of activeChannels) {
                const memberCount = this.server.getChannelMembers(connection, channelName).length;
                this.sendReply(connection, IRC_REPLIES.RPL_LIST, `${channelName} ${memberCount} :Active channel`);
            }
        }

        // End of LIST
        this.sendReply(connection, IRC_REPLIES.RPL_LISTEND, ':End of /LIST');
    }

    /**
     * Fetch available schemas from monk-api
     */
    private async fetchSchemas(connection: IrcConnection): Promise<Array<{ name: string; description?: string }>> {
        try {
            // Query the /api/data/schemas endpoint to get full schema records (name, description, etc.)
            const response = await this.apiRequest(connection, '/api/data/schemas');

            if (!response.ok) {
                if (this.debug) {
                    console.log(`📋 [${connection.id}] API /api/data/schemas returned ${response.status}`);
                }
                return [];
            }

            const result = await response.json() as {
                success?: boolean;
                data?: Array<{ name: string; description?: string; [key: string]: any }>;
            };

            // Handle response: monk-api returns { success: true, data: [{ name: "users", description: "...", ... }] }
            const schemas = result.data || [];

            // Extract just name and description
            const schemaList = schemas.map(schema => ({
                name: schema.name,
                description: schema.description
            }));

            if (this.debug) {
                const names = schemaList.map(s => s.name).join(', ');
                console.log(`📋 [${connection.id}] Fetched ${schemaList.length} schemas from API: ${names}`);
            }

            return schemaList;

        } catch (error) {
            if (this.debug) {
                console.error(`❌ Error fetching schemas:`, error);
            }
            return [];
        }
    }
}
