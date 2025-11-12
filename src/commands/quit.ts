/**
 * QUIT command handler - Disconnect from server
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class QuitCommand extends BaseIrcCommand {
    readonly name = 'QUIT';
    readonly needsRegistration = false;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const quitMessage = args.startsWith(':') ? args.substring(1) : args || 'Client quit';

        if (this.debug) {
            console.log(`👋 [${connection.id}] ${connection.nickname || 'Unknown'} quit: ${quitMessage}`);
        }

        // Send ERROR message to client
        this.sendMessage(connection, `ERROR :Closing connection: ${quitMessage}`);

        // Close the connection
        connection.socket.end();
    }
}
