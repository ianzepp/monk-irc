/**
 * FORCEPART command handler - Politely remove user from channel
 * Requires force-part capability and root/full access
 *
 * This is a "polite kick" - makes the user PART instead of being KICKed
 * Usage: FORCEPART <channel> <nickname> [:<reason>]
 * Example: FORCEPART #products alice :Conversation complete
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class ForcepartCommand extends BaseIrcCommand {
    readonly name = 'FORCEPART';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: FORCEPART <channel> <nickname> [:<reason>]
        const parts = args.split(' ');
        if (parts.length < 2) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'FORCEPART :Not enough parameters');
            return;
        }

        const channelName = parts[0];
        const targetNick = parts[1];
        const reasonIndex = args.indexOf(':');
        const reason = reasonIndex > -1 ? args.substring(reasonIndex + 1) : 'Requested to leave';

        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Get tenant and sender
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const sender = tenant.getUserByConnection(connection);
        if (!sender) return;

        // Check if sender has force-part capability
        if (!sender.hasCapability('force-part')) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
                ':Permission denied - requires force-part capability');
            return;
        }

        // Check if sender has proper access level
        const accessLevel = sender.getAccessLevel();
        if (accessLevel !== 'root' && accessLevel !== 'full') {
            this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
                ':Permission denied - requires root or full access');
            return;
        }

        // Get channel
        const channel = tenant.getChannel(channelName);
        if (!channel) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Find target user
        const targetUser = tenant.getUserByNickname(targetNick);
        if (!targetUser) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Check if target is in the channel
        if (!channel.hasMember(targetUser)) {
            this.sendReply(connection, IRC_REPLIES.ERR_USERNOTINCHANNEL, `${targetNick} ${channelName} :They aren't on that channel`);
            return;
        }

        if (this.debug) {
            console.log(`👋 [${connection.id}] ${sender.getNickname()} force-parting ${targetNick} from ${channelName}: ${reason}`);
        }

        // Build PART message with reason
        const targetPrefix = targetUser.getUserPrefix();
        const partMessage = `:${targetPrefix} PART ${channelName} :${reason}`;

        // Broadcast PART to all channel members (including target)
        channel.broadcast(partMessage);

        // Remove user from channel
        channel.removeMember(targetUser);
        targetUser.partChannel(channel);

        // Clean up empty channel
        if (channel.isEmpty()) {
            tenant.removeChannel(channelName);
        }

        // Confirm to sender
        this.sendMessage(connection, `:${this.serverName} NOTICE ${sender.getNickname()} :Force-parted ${targetNick} from ${channelName}`);

        if (this.debug) {
            console.log(`✅ [${connection.id}] ${targetNick} force-parted from ${channelName}`);
        }
    }
}
