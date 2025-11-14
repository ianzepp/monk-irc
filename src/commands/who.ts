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

        // Get tenant
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        // Check if it's a channel
        if (mask.startsWith('#')) {
            // WHO for channel
            const channel = tenant.getChannel(mask);

            if (channel) {
                const members = channel.getMembers();

                for (const member of members) {
                    // RPL_WHOREPLY (352): "<channel> <user> <host> <server> <nick> <H|G>[*][@|+] :<hopcount> <real name>"
                    // H = here, G = gone (away)
                    // * = IRC operator
                    // @ = channel operator, + = voiced
                    let flags = member.isAway() ? 'G' : 'H';

                    // Add channel status
                    if (channel.isOperator(member)) {
                        flags += '@';
                    } else if (channel.hasVoice(member)) {
                        flags += '+';
                    }

                    this.sendReply(
                        connection,
                        '352',
                        `${mask} ${member.getUsername()} ${member.getHostname()} ${this.serverName} ${member.getNickname()} ${flags} :0 ${member.getRealname()}`
                    );
                }
            }

            this.sendReply(connection, '315', `${mask} :End of WHO list`);
        } else {
            // WHO for specific user
            const targetUser = tenant.getUserByNickname(mask);

            if (targetUser) {
                const flags = targetUser.isAway() ? 'G' : 'H';
                // Find what channels they're in (optional, show first one or *)
                const channels = targetUser.getChannelNames();
                const channel = channels.length > 0 ? channels[0] : '*';

                this.sendReply(
                    connection,
                    '352',
                    `${channel} ${targetUser.getUsername()} ${targetUser.getHostname()} ${this.serverName} ${targetUser.getNickname()} ${flags} :0 ${targetUser.getRealname()}`
                );
            }

            this.sendReply(connection, '315', `${mask} :End of WHO list`);
        }

        if (this.debug) {
            console.log(`👤 [${connection.id}] WHO query completed for ${mask}`);
        }
    }
}
