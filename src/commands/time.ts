/**
 * TIME command handler - Server time
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class TimeCommand extends BaseIrcCommand {
    readonly name = 'TIME';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Get current server time
        const now = new Date();

        // Format: Day Month Date HH:MM:SS Year (human-readable)
        const timeString = now.toString();

        // Send TIME reply: 391 <nick> <server> :<time string>
        this.sendReply(connection, IRC_REPLIES.RPL_TIME, `${this.serverName} :${timeString}`);
    }
}
