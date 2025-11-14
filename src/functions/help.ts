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

        // Filter functions based on channel type
        const availableFunctions = allFunctions.filter((func: any) => {
            // Help is always available
            if (func.name === 'help') {
                return true;
            }

            // Record channels: only certain functions make sense
            if (isRecordChannel) {
                // Currently no record-specific functions, but help is always available
                return false;
            }

            // Schema channels: all functions except help (already included)
            return func.name !== 'help';
        });

        if (isRecordChannel) {
            const schema = channel.getSchemaName();
            const recordId = channel.getRecordId();
            this.sendNotice(channel, `Record channel: ${schema}/${recordId}`);

            if (availableFunctions.length === 0) {
                this.sendNotice(channel, 'No functions available in record channels yet');
                this.sendNotice(channel, 'Use normal IRC commands or discuss the record here');
            } else {
                this.sendNotice(channel, 'Available functions:');
                for (const func of availableFunctions) {
                    this.sendNotice(channel, `  !${func.name} - ${func.description}`);
                }
            }
        } else {
            // Schema channel
            this.sendNotice(channel, 'Available functions:');

            // Always show help first
            this.sendNotice(channel, '  !help - List available functions');

            for (const func of availableFunctions) {
                this.sendNotice(channel, `  !${func.name} - ${func.description}`);
            }

            this.sendNotice(channel, 'Use !help <function> for details');
        }
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
