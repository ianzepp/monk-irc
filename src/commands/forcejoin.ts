/**
 * FORCEJOIN command handler - Force a user to join a channel
 * Requires force-join capability and root/full access
 *
 * Usage: FORCEJOIN <nickname> <channel>
 * Example: FORCEJOIN alice #products/config-123
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';
import { ChannelMode } from '../lib/channel.js';

export class ForcejoinCommand extends BaseIrcCommand {
    readonly name = 'FORCEJOIN';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: FORCEJOIN <nickname> <channel>
        const parts = args.trim().split(' ');
        if (parts.length < 2) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'FORCEJOIN :Not enough parameters');
            return;
        }

        const targetNick = parts[0];
        const channelName = parts[1];

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

        // Check if sender has force-join capability
        if (!sender.hasCapability('force-join')) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
                ':Permission denied - requires force-join capability');
            return;
        }

        // Check if sender has proper access level
        const accessLevel = sender.getAccessLevel();
        if (accessLevel !== 'root' && accessLevel !== 'full') {
            this.sendReply(connection, IRC_REPLIES.ERR_NOPRIVILEGES,
                ':Permission denied - requires root or full access');
            return;
        }

        // Find target user
        const targetUser = tenant.getUserByNickname(targetNick);
        if (!targetUser) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Get or create channel
        const channel = tenant.getOrCreateChannel(channelName, sender.getNickname());

        // Check if target is already in channel
        if (channel.hasMember(targetUser)) {
            this.sendReply(connection, IRC_REPLIES.ERR_USERONCHANNEL, `${targetNick} ${channelName} :is already on channel`);
            return;
        }

        if (this.debug) {
            console.log(`🚀 [${connection.id}] ${sender.getNickname()} force-joining ${targetNick} to ${channelName}`);
        }

        // Determine target's role based on their access level
        const targetRoles = this.getUserRolesFromAccessLevel(targetUser, false);

        // Add target to channel
        channel.addMember(targetUser, targetRoles);
        targetUser.joinChannel(channel);

        // Send JOIN message to target
        const targetPrefix = targetUser.getUserPrefix();
        targetUser.sendMessage(`:${targetPrefix} JOIN ${channelName}`);

        // Send topic to target
        const topic = channel.getTopic();
        const targetConn = targetUser.getConnection();
        if (topic && targetConn) {
            this.sendReply(targetConn, IRC_REPLIES.RPL_TOPIC, `${channelName} :${topic}`);
        } else if (targetConn) {
            this.sendReply(targetConn, IRC_REPLIES.RPL_NOTOPIC, `${channelName} :No topic is set`);
        }

        // Send names list to target
        const memberList = channel.getMemberListWithRoles();
        if (targetConn) {
            this.sendReply(targetConn, IRC_REPLIES.RPL_NAMREPLY, `= ${channelName} :${memberList}`);
            this.sendReply(targetConn, IRC_REPLIES.RPL_ENDOFNAMES, `${channelName} :End of /NAMES list`);
        }

        // Broadcast JOIN to other channel members
        for (const member of channel.getMembers()) {
            if (member === targetUser) continue;
            member.sendMessage(`:${targetPrefix} JOIN ${channelName}`);
        }

        // Confirm to sender
        this.sendMessage(connection, `:${this.serverName} NOTICE ${sender.getNickname()} :Force-joined ${targetNick} to ${channelName}`);

        if (this.debug) {
            console.log(`✅ [${connection.id}] ${targetNick} force-joined to ${channelName}`);
        }
    }

    /**
     * Determine user's channel roles based on their global access level
     */
    private getUserRolesFromAccessLevel(user: any, isFirstMember: boolean): Set<ChannelMode> {
        const roles = new Set<ChannelMode>();

        if (isFirstMember) {
            roles.add(ChannelMode.OPERATOR);
            return roles;
        }

        const accessLevel = user.getAccessLevel();

        if (accessLevel === 'root' || accessLevel === 'full') {
            roles.add(ChannelMode.OPERATOR);
        } else if (accessLevel === 'edit') {
            roles.add(ChannelMode.VOICE);
        }

        return roles;
    }
}
