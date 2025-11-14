/**
 * Set function - Update a field in the current record
 * STUB: Not yet implemented
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class SetFunction extends BaseFunction {
    readonly name = 'set';
    readonly description = 'Update a field in the current record';
    readonly usage = '!set <field> <value>';
    readonly requiresSchema = true;

    constructor(config: ServerConfig, server: any) {
        super(config, server);
    }

    async executeFunction(sender: any, channel: any, args: string[]): Promise<void> {
        // Validate we're in a record channel
        const isRecordChannel = channel.isRecordChannel();
        if (!isRecordChannel) {
            this.sendNoticeToSender(sender, channel, 'This function only works in record channels');
            return;
        }

        const schema = channel.getSchemaName();
        const recordId = channel.getRecordId();

        if (!schema || !recordId) {
            this.sendNoticeToSender(sender, channel, 'Failed to determine record context');
            return;
        }

        // Parse arguments
        const field = args[0];
        const value = args.slice(1).join(' ');

        if (!field) {
            this.sendNoticeToSender(sender, channel, 'Usage: !set <field> <value>');
            return;
        }

        if (!value) {
            this.sendNoticeToSender(sender, channel, 'Usage: !set <field> <value>');
            return;
        }

        if (this.debug) {
            console.log(`🔧 [${sender.getNickname()}] !set ${field}=${value} in ${schema}/${recordId}`);
        }

        try {
            const conn = sender.getConnection();

            // Build File API path: /data/schema/recordId/field
            const filePath = `/data/${schema}/${recordId}/${field}`;

            // Try to parse value as JSON if it looks structured
            let parsedValue: any = value;
            if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false' || !isNaN(Number(value))) {
                try {
                    parsedValue = JSON.parse(value);
                } catch {
                    // Keep as string if JSON parse fails
                    parsedValue = value;
                }
            }

            // Store the field using File API
            const result = await this.fileStore(conn, filePath, parsedValue, {
                atomic: true,
                overwrite: true
            });

            // Broadcast success to channel
            const displayValue = typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue);
            this.sendNotice(channel, `${sender.getNickname()} set ${field} = ${displayValue}`);

            if (this.debug) {
                console.log(`✅ [${sender.getNickname()}] Set ${field} in ${schema}/${recordId}:`, result);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.sendNoticeToSender(sender, channel, `Failed to set ${field}: ${message}`);

            if (this.debug) {
                console.error(`❌ Set function error:`, error);
            }
        }
    }
}
