/**
 * Count function - Count records in schema
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class CountFunction extends BaseFunction {
    readonly name = 'count';
    readonly description = 'Count records in current schema';
    readonly usage = '!count [--where field=value]';
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

        if (this.debug) {
            console.log(`🔢 [${sender.getNickname()}] !count in ${schema}:`, { where });
        }

        try {
            const conn = sender.getConnection();
            const aggregateQuery: any = {
                aggregate: {
                    total: { $count: '*' }
                }
            };

            if (Object.keys(where).length > 0) {
                aggregateQuery.where = where;
            }

            const response = await this.apiRequest(conn, `/api/aggregate/${schema}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(aggregateQuery)
            });

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `Count failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any[] };
            const count = result.data?.[0]?.total || 0;

            const whereDesc = Object.keys(where).length > 0
                ? ` (where ${this.formatWhere(where)})`
                : '';

            this.sendNotice(channel, `Total: ${count} record(s)${whereDesc}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ Count function error:`, error);
            }
        }
    }

    /**
     * Parse --where clause (same as find function)
     */
    private parseWhereClause(argsStr: string): any {
        const whereMatch = argsStr.match(/--where\s+(.+?)(?:\s+--|\s*$)/);
        if (!whereMatch) {
            return {};
        }

        const whereStr = whereMatch[1].trim();
        const conditions: any = {};

        const pairs = whereStr.split(/\s+and\s+/i);

        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value !== undefined) {
                if (value === 'true') {
                    conditions[key] = true;
                } else if (value === 'false') {
                    conditions[key] = false;
                } else if (!isNaN(Number(value))) {
                    conditions[key] = Number(value);
                } else {
                    conditions[key] = value.replace(/^["']|["']$/g, '');
                }
            }
        }

        return conditions;
    }

    /**
     * Format where clause for display
     */
    private formatWhere(where: any): string {
        return Object.entries(where)
            .map(([key, value]) => `${key}=${value}`)
            .join(' and ');
    }
}
