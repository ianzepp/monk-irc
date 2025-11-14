/**
 * OPER command handler - Operator authentication (not implemented)
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class OperCommand extends BaseIrcCommand {
    readonly name = 'OPER';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // OPER not implemented - stateless bridge has no operators
        this.sendReply(connection, IRC_REPLIES.ERR_NOOPERHOST,
            ':OPER command not supported - monk-irc is a stateless bridge with no operator concept');
    }
}
