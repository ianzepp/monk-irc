/**
 * VERSION command handler - Show server version info
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class VersionCommand extends BaseIrcCommand {
    readonly name = 'VERSION';
    readonly needsRegistration = false;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Get monk-irc version from package.json
        const version = 'monk-irc-2.0.0';
        const comments = 'Pure IRC→monk-api bridge';

        // Format: RPL_VERSION <version>.<debuglevel> <server> :<comments>
        this.sendReply(connection, IRC_REPLIES.RPL_VERSION, `${version} ${this.serverName} :${comments}`);

        if (this.debug) {
            console.log(`ℹ️  [${connection.id}] VERSION query from ${connection.nickname || 'unregistered'}`);
        }
    }
}
