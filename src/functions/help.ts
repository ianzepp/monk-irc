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
            // Show list of all functions
            await this.showAllFunctions(channel);
        }
    }

    private async showAllFunctions(channel: any): Promise<void> {
        const registry = this.server.getFunctionRegistry();
        const functions = registry.getAll();

        this.sendNotice(channel, 'Available functions:');

        for (const func of functions) {
            this.sendNotice(channel, `  !${func.name} - ${func.description}`);
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
