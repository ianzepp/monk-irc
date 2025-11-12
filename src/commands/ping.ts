/**
 * PING command handler - Connection keepalive
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class PingCommand extends BaseIrcCommand {
    readonly name = 'PING';
    readonly needsRegistration = false;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // PING :server -> PONG server :server
        const token = args.trim() || this.serverName;

        this.sendMessage(connection, `:${this.serverName} PONG ${this.serverName} :${token}`);

        if (this.debug) {
            console.log(`🏓 [${connection.id}] PING/PONG: ${token}`);
        }
    }
}
