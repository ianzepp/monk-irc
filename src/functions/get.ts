/**
 * Get function - Fetch a specific record by ID
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class GetFunction extends BaseFunction {
    readonly name = 'get';
    readonly description = 'Fetch a specific record by ID';
    readonly usage = '!get <id> [--fields field1,field2]';
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
        if (!recordId || recordId.startsWith('--')) {
            this.sendNoticeToSender(sender, channel, 'Usage: !get <id> [--fields field1,field2]');
            return;
        }

        const argsStr = args.slice(1).join(' ');
        const fields = this.parseFields(argsStr);

        if (this.debug) {
            console.log(`📄 [${sender.getNickname()}] !get ${recordId} in ${schema}`);
        }

        try {
            const conn = sender.getConnection();
            const response = await this.apiRequest(conn, `/api/data/${schema}/${recordId}`);

            if (response.status === 404) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `Get failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any };
            const record = result.data;

            if (!record) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            // Display record
            this.sendNotice(channel, `Record: ${recordId}`);

            if (fields && fields.length > 0) {
                // Show only requested fields
                for (const field of fields) {
                    const value = record[field];
                    if (value !== undefined) {
                        this.sendNotice(channel, `  ${field}: ${JSON.stringify(value)}`);
                    }
                }
            } else {
                // Show all fields (limited to reasonable size)
                const recordStr = JSON.stringify(record, null, 2);
                const lines = recordStr.split('\n');

                // Limit output to prevent spam
                const maxLines = 20;
                for (const line of lines.slice(0, maxLines)) {
                    this.sendNotice(channel, `  ${line}`);
                }

                if (lines.length > maxLines) {
                    this.sendNotice(channel, `  ... (${lines.length - maxLines} more lines, use --fields to filter)`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ Get function error:`, error);
            }
        }
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
