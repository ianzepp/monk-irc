/**
 * MOTD command handler - Show Message of the Day
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class MotdCommand extends BaseIrcCommand {
    readonly name = 'MOTD';
    readonly needsRegistration = false;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Send MOTD
        this.sendMotd(connection);

        if (this.debug) {
            console.log(`📋 [${connection.id}] MOTD requested by ${connection.nickname || 'unregistered'}`);
        }
    }
}
