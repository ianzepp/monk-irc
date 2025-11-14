/**
 * Help function - List available functions
 */

import { BaseFunction } from './base-function.js';
import type { ServerConfig } from '../lib/types.js';

export class HelpFunction extends BaseFunction {
    readonly name = 'help';
    readonly description = 'List available functions';
    readonly usage = '!help [function]';
    readonly requiresSchema = false;

    constructor(config: ServerConfig, server: any) {
        super(config, server);
    }

    async executeFunction(sender: any, channel: any, args: string[]): Promise<void> {
        const functionName = args[0]?.toLowerCase();

        if (functionName) {
            // Show detailed help for specific function
            await this.showFunctionHelp(channel, functionName);
        } else {
            // Show list of all functions (context-aware)
            await this.showAllFunctions(channel);
        }
    }

    private async showAllFunctions(channel: any): Promise<void> {
        const registry = this.server.getFunctionRegistry();
        const allFunctions = registry.getAll();
        const isRecordChannel = channel.isRecordChannel();

        // Define which functions are available in each context
        const schemaOnlyFunctions = ['find', 'list', 'count', 'open'];
        const recordOnlyFunctions = ['set', 'unset', 'refresh'];
        const bothContextFunctions = ['help', 'show', 'get'];

        // Filter functions based on channel type
        const availableFunctions = allFunctions.filter((func: any) => {
            // Functions available in both contexts
            if (bothContextFunctions.includes(func.name)) {
                return true;
            }

            // Record channels: only record-specific functions
            if (isRecordChannel) {
                return recordOnlyFunctions.includes(func.name);
            }

            // Schema channels: schema-specific functions (both-context already included)
            return schemaOnlyFunctions.includes(func.name);
        });

        this.sendNotice(channel, 'Available functions:');

        // Sort functions for display
        const sortedFunctions = availableFunctions.sort((a: any, b: any) => a.name.localeCompare(b.name));

        for (const func of sortedFunctions) {
            this.sendNotice(channel, `  !${func.name} - ${func.description}`);
        }

        if (isRecordChannel) {
            const schema = channel.getSchemaName();
            const recordId = channel.getRecordId();
            this.sendNotice(channel, `Context: record ${schema}/${recordId}`);
        } else {
            const schema = channel.getSchemaName();
            this.sendNotice(channel, `Context: schema ${schema}`);
        }

        this.sendNotice(channel, 'Use !help <function> for details');
    }

    private async showFunctionHelp(channel: any, functionName: string): Promise<void> {
        const registry = this.server.getFunctionRegistry();
        const func = registry.get(functionName);

        if (!func) {
            this.sendNotice(channel, `Unknown function: ${functionName}`);
            return;
        }

        this.sendNotice(channel, `Function: !${func.name}`);
        this.sendNotice(channel, `Description: ${func.description}`);
        this.sendNotice(channel, `Usage: ${func.usage}`);

        if (func.requiresSchema) {
            this.sendNotice(channel, `Requires: Schema channel (#schema or #schema/record)`);
        }
    }
}
