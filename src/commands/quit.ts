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

        // Get tenant and user
        const tenant = this.server.getTenantForConnection(connection);
        if (tenant) {
            const user = tenant.getUserByConnection(connection);
            if (user) {
                if (this.debug) {
                    console.log(`👋 [${connection.id}] ${user.getNickname()} quit: ${quitMessage}`);
                }

                // Broadcast QUIT to all channels the user is in
                const quitMsg = `:${user.getUserPrefix()} QUIT :${quitMessage}`;
                const channels = user.getChannels();

                for (const channel of channels) {
                    // Broadcast to all members except the quitting user
                    channel.broadcast(quitMsg, user);
                }

                // Send ERROR message to client
                this.sendMessage(connection, `ERROR :Closing connection: ${quitMessage}`);

                // Close the connection
                connection.socket.end();
                return;
            }
        }

        // Fallback for users not fully registered
        if (this.debug) {
            console.log(`👋 [${connection.id}] ${connection.nickname || 'Unknown'} quit: ${quitMessage}`);
        }

        // Send ERROR message to client
        this.sendMessage(connection, `ERROR :Closing connection: ${quitMessage}`);

        // Close the connection
        connection.socket.end();
    }
}
