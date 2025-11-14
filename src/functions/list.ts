/**
 * List function - List all records in schema
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class ListFunction extends BaseFunction {
    readonly name = 'list';
    readonly description = 'List all records in current schema';
    readonly usage = '!list [--limit N]';
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
        const argsStr = args.join(' ');
        const limit = this.parseLimit(argsStr);

        if (this.debug) {
            console.log(`📝 [${sender.getNickname()}] !list in ${schema} (limit: ${limit})`);
        }

        try {
            const conn = sender.getConnection();

            // Build query URL with limit
            const url = `/api/data/${schema}?limit=${limit}`;
            const response = await this.apiRequest(conn, url);

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `List failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any[] };
            const records = result.data || [];

            if (records.length === 0) {
                this.sendNotice(channel, 'No records found');
                return;
            }

            // Display results
            this.sendNotice(channel, `Records in ${schema} (showing ${records.length}):`);

            for (const record of records) {
                const formatted = this.formatRecordSummary(record);
                this.sendNotice(channel, `  ${formatted}`);
            }

            if (records.length === limit) {
                this.sendNotice(channel, `... use --limit to adjust (current: ${limit})`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ List function error:`, error);
            }
        }
    }

    /**
     * Parse --limit flag
     */
    private parseLimit(argsStr: string): number {
        const limitMatch = argsStr.match(/--limit\s+(\d+)/);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1]);
            return Math.min(limit, 100); // Cap at 100
        }
        return 20; // Default
    }

    /**
     * Format a record for summary display
     */
    private formatRecordSummary(record: any): string {
        const id = record.id || record._id || record.username || record.name;

        // Try common label fields
        const label = record.name || record.title || record.label || record.description || record.email;

        if (label && label !== id) {
            // Truncate long labels
            const truncatedLabel = label.length > 50 ? label.substring(0, 47) + '...' : label;
            return `${id}: ${truncatedLabel}`;
        }

        return String(id);
    }
}
