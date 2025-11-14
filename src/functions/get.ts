/**
 * Get function - Fetch a specific record by ID
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class GetFunction extends BaseFunction {
    readonly name = 'get';
    readonly description = 'Get specific field(s) from a record';
    readonly usage = '!get <id> [--fields fields] (schema) or !get [field...] (record)';
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

        // Determine record ID and fields based on context
        const isRecordChannel = channel.isRecordChannel();
        let recordId: string;
        let fields: string[] | undefined;

        if (isRecordChannel) {
            // In record channel: use current record, args are field names
            recordId = channel.getRecordId();
            if (!recordId) {
                this.sendNoticeToSender(sender, channel, 'Failed to determine record ID from channel');
                return;
            }

            // All args are fields (no --fields flag needed)
            if (args.length > 0) {
                fields = args;
            }
        } else {
            // In schema channel: first arg is ID, then optional --fields
            recordId = args[0];
            if (!recordId || recordId.startsWith('--')) {
                this.sendNoticeToSender(sender, channel, 'Usage: !get <id> [--fields field1,field2]');
                return;
            }

            const argsStr = args.slice(1).join(' ');
            fields = this.parseFields(argsStr);
        }

        if (this.debug) {
            console.log(`📄 [${sender.getNickname()}] !get ${recordId} in ${schema}`);
        }

        try {
            const conn = sender.getConnection();

            if (fields && fields.length > 0) {
                // Get specific fields using File API
                for (const field of fields) {
                    try {
                        // Build File API path: /data/schema/recordId/field
                        const filePath = `/data/${schema}/${recordId}/${field}`;
                        const result = await this.fileRetrieve(conn, filePath, { format: 'json' });

                        if (this.debug) {
                            console.log(`📥 File API response for ${filePath}:`, JSON.stringify(result, null, 2));
                        }

                        // File API returns { success: true, content: value, file_metadata: {...} }
                        const value = result.content;

                        if (value === undefined || value === null) {
                            this.sendNotice(channel, `${field}: (not set)`);
                        } else {
                            const displayValue = typeof value === 'string'
                                ? value
                                : JSON.stringify(value);
                            this.sendNotice(channel, `${field}: ${displayValue}`);
                        }
                    } catch (error) {
                        // Field might not exist or access denied
                        const message = error instanceof Error ? error.message : 'error';
                        if (this.debug) {
                            console.log(`⚠️  Failed to get ${field}:`, message);
                        }
                        this.sendNotice(channel, `${field}: (not found)`);
                    }
                }
            } else {
                // Get whole record using File API
                const filePath = `/data/${schema}/${recordId}.json`;
                const result = await this.fileRetrieve(conn, filePath, { format: 'json' });

                if (!result.content) {
                    this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                    return;
                }

                // Display all fields
                this.sendNotice(channel, `Record: ${recordId}`);

                const record = result.content;
                const recordStr = JSON.stringify(record, null, 2);
                const lines = recordStr.split('\n');

                // Limit output to prevent spam
                const maxLines = 20;
                for (const line of lines.slice(0, maxLines)) {
                    this.sendNotice(channel, `  ${line}`);
                }

                if (lines.length > maxLines) {
                    this.sendNotice(channel, `  ... (${lines.length - maxLines} more lines)`);
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
