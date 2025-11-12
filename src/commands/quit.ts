/**
 * QUIT command handler - Disconnect from server
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class QuitCommand extends BaseIrcCommand {
    readonly name = 'QUIT';
    readonly needsRegistration = false;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const quitMessage = args.startsWith(':') ? args.substring(1) : args || 'Client quit';

        if (this.debug) {
            console.log(`👋 [${connection.id}] ${connection.nickname || 'Unknown'} quit: ${quitMessage}`);
        }

        // Broadcast QUIT to all channels the user is in
        if (connection.nickname) {
            const quitMsg = `:${this.getUserPrefix(connection)} QUIT :${quitMessage}`;
            for (const channelName of connection.channels) {
                this.server.broadcastToChannel(channelName, quitMsg, connection);
            }
        }

        // Send ERROR message to client
        this.sendMessage(connection, `ERROR :Closing connection: ${quitMessage}`);

        // Close the connection
        connection.socket.end();
    }
}
