/**
 * Find function - Query records in schema
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class FindFunction extends BaseFunction {
    readonly name = 'find';
    readonly description = 'Search records in current schema';
    readonly usage = '!find [--where field=value] [--limit N] [--fields field1,field2]';
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
        const where = this.parseWhereClause(argsStr);
        const limit = this.parseLimit(argsStr);
        const fields = this.parseFields(argsStr);

        if (this.debug) {
            console.log(`🔍 [${sender.getNickname()}] !find in ${schema}:`, { where, limit, fields });
        }

        try {
            const conn = sender.getConnection();
            const queryBody: any = { limit };
            if (Object.keys(where).length > 0) {
                queryBody.where = where;
            }
            if (fields && fields.length > 0) {
                queryBody.select = fields;
            }

            const response = await this.apiRequest(conn, `/api/find/${schema}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryBody)
            });

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `Query failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any[] };
            const records = result.data || [];

            if (records.length === 0) {
                this.sendNotice(channel, 'No records found');
                return;
            }

            // Display results
            this.sendNotice(channel, `Found ${records.length} record(s):`);

            for (const record of records.slice(0, 10)) {
                const formatted = this.formatRecord(record, fields);
                this.sendNotice(channel, `  ${formatted}`);
            }

            if (records.length > 10) {
                this.sendNotice(channel, `... and ${records.length - 10} more (use --limit to see more)`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ Find function error:`, error);
            }
        }
    }

    /**
     * Parse --where clause
     * Supports: --where field=value or --where field=value and field2=value2
     */
    private parseWhereClause(argsStr: string): any {
        const whereMatch = argsStr.match(/--where\s+(.+?)(?:\s+--|\s*$)/);
        if (!whereMatch) {
            return {};
        }

        const whereStr = whereMatch[1].trim();
        const conditions: any = {};

        // Split by 'and' keyword (case-insensitive)
        const pairs = whereStr.split(/\s+and\s+/i);

        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value !== undefined) {
                // Try to parse as number or boolean
                if (value === 'true') {
                    conditions[key] = true;
                } else if (value === 'false') {
                    conditions[key] = false;
                } else if (!isNaN(Number(value))) {
                    conditions[key] = Number(value);
                } else {
                    // Remove quotes if present
                    conditions[key] = value.replace(/^["']|["']$/g, '');
                }
            }
        }

        return conditions;
    }

    /**
     * Parse --limit flag
     */
    private parseLimit(argsStr: string): number {
        const limitMatch = argsStr.match(/--limit\s+(\d+)/);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1]);
            return Math.min(limit, 50); // Cap at 50
        }
        return 10; // Default
    }

    /**
     * Parse --fields flag
     */
    private parseFields(argsStr: string): string[] | undefined {
        const fieldsMatch = argsStr.match(/--fields\s+([a-zA-Z0-9_,]+)/);
        if (fieldsMatch) {
            return fieldsMatch[1].split(',').map(f => f.trim());
        }
        return undefined;
    }
}
