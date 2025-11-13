/**
 * WHO command handler - Query user information
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';

export class WhoCommand extends BaseIrcCommand {
    readonly name = 'WHO';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const mask = args.trim().split(' ')[0];

        if (!mask) {
            // No mask specified
            this.sendReply(connection, '315', '* :End of WHO list');
            return;
        }

        if (this.debug) {
            console.log(`👤 [${connection.id}] ${connection.nickname} requesting WHO for ${mask}`);
        }

        // Check if it's a channel
        if (mask.startsWith('#')) {
            // WHO for channel
            const members = this.server.getChannelMembers(connection, mask);
            
            for (const member of members) {
                if (member.nickname) {
                    // RPL_WHOREPLY (352): "<channel> <user> <host> <server> <nick> <H|G>[*][@|+] :<hopcount> <real name>"
                    // H = here, G = gone (away)
                    // * = IRC operator
                    // @ = channel operator, + = voiced
                    const flags = 'H'; // Always "here" for now
                    this.sendReply(
                        connection,
                        '352',
                        `${mask} ${member.username || '~user'} ${member.hostname} ${this.serverName} ${member.nickname} ${flags} :0 ${member.realname || 'Unknown'}`
                    );
                }
            }

            this.sendReply(connection, '315', `${mask} :End of WHO list`);
        } else {
            // WHO for specific user
            const targetConnection = this.server.getConnectionByNickname(mask);

            // Only show users from same tenant (tenant isolation)
            if (targetConnection && targetConnection.nickname && targetConnection.tenant === connection.tenant) {
                const flags = 'H';
                // Find what channels they're in (optional, show first one or *)
                const channel = targetConnection.channels.size > 0 
                    ? Array.from(targetConnection.channels)[0] 
                    : '*';
                
                this.sendReply(
                    connection,
                    '352',
                    `${channel} ${targetConnection.username || '~user'} ${targetConnection.hostname} ${this.serverName} ${targetConnection.nickname} ${flags} :0 ${targetConnection.realname || 'Unknown'}`
                );
            }

            this.sendReply(connection, '315', `${mask} :End of WHO list`);
        }

        if (this.debug) {
            console.log(`👤 [${connection.id}] WHO query completed for ${mask}`);
        }
    }
}
