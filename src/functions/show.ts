/**
 * Show function - Display record details line by line
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class ShowFunction extends BaseFunction {
    readonly name = 'show';
    readonly description = 'Display detailed record information';
    readonly usage = '!show <id> (schema) or !show (record)';
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

        // Determine record ID: from args or from channel context
        const isRecordChannel = channel.isRecordChannel();
        let recordId: string;

        if (isRecordChannel) {
            // In record channel: use current record (args ignored)
            recordId = channel.getRecordId();
            if (!recordId) {
                this.sendNoticeToSender(sender, channel, 'Failed to determine record ID from channel');
                return;
            }
        } else {
            // In schema channel: require ID argument
            recordId = args[0];
            if (!recordId) {
                this.sendNoticeToSender(sender, channel, 'Usage: !show <id>');
                return;
            }
        }

        if (this.debug) {
            console.log(`📋 [${sender.getNickname()}] !show ${recordId} in ${schema}`);
        }

        try {
            const conn = sender.getConnection();
            const response = await this.apiRequest(conn, `/api/data/${schema}/${recordId}`);

            if (response.status === 404) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            if (!response.ok) {
                this.sendNoticeToSender(sender, channel, `Show failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json() as { data?: any };
            const record = result.data;

            if (!record) {
                this.sendNoticeToSender(sender, channel, `Record not found: ${recordId}`);
                return;
            }

            // Display record header
            this.sendNotice(channel, `Record: ${schema}/${recordId}`);
            this.sendNotice(channel, `${'─'.repeat(40)}`);

            // Display each field line by line
            for (const [key, value] of Object.entries(record)) {
                const formattedValue = this.formatValue(value);
                this.sendNotice(channel, `${key}: ${formattedValue}`);
            }

            this.sendNotice(channel, `${'─'.repeat(40)}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Error: ${message}`);

            if (this.debug) {
                console.error(`❌ Show function error:`, error);
            }
        }
    }

    /**
     * Format value for display
     */
    private formatValue(value: any): string {
        if (value === null) {
            return '(null)';
        }
        if (value === undefined) {
            return '(undefined)';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'boolean' || typeof value === 'number') {
            return String(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            if (value.length <= 3) {
                return `[${value.join(', ')}]`;
            }
            return `[${value.slice(0, 3).join(', ')}, ... +${value.length - 3} more]`;
        }
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0) {
                return '{}';
            }
            return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
        }
        return JSON.stringify(value);
    }
}
