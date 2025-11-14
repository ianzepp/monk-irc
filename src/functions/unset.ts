/**
 * Unset function - Clear a field in the current record
 * STUB: Not yet implemented
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class UnsetFunction extends BaseFunction {
    readonly name = 'unset';
    readonly description = 'Clear a field in the current record';
    readonly usage = '!unset <field>';
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

        // Parse arguments
        const field = args[0];

        if (!field) {
            this.sendNoticeToSender(sender, channel, 'Usage: !unset <field>');
            return;
        }

        // STUB: Not yet implemented
        this.sendNoticeToSender(sender, channel, `!unset is not yet implemented (would clear ${field})`);

        if (this.debug) {
            const schema = channel.getSchemaName();
            const recordId = channel.getRecordId();
            console.log(`🔧 [${sender.getNickname()}] !unset ${field} in ${schema}/${recordId} (stub)`);
        }
    }
}
