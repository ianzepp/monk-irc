/**
 * INVITE command handler - Invite user to join a channel
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class InviteCommand extends BaseIrcCommand {
    readonly name = 'INVITE';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Parse: INVITE <nickname> <channel>
        const parts = args.trim().split(' ');
        if (parts.length < 2) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'INVITE :Not enough parameters');
            return;
        }

        const targetNick = parts[0];
        const channelName = parts[1];

        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Get tenant, inviter, and channel
        const tenant = this.server.getTenantForConnection(connection);
        if (!tenant) return;

        const inviter = tenant.getUserByConnection(connection);
        if (!inviter) return;

        const channel = tenant.getChannel(channelName);
        if (!channel) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Check if inviter is in the channel
        if (!channel.hasMember(inviter)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Check if inviter has permission to invite
        if (!channel.canInvite(inviter)) {
            this.sendReply(connection, IRC_REPLIES.ERR_CHANOPRIVSNEEDED,
                `${channelName} :You're not a channel operator`);
            return;
        }

        // Find target user
        const targetUser = tenant.getUserByNickname(targetNick);
        if (!targetUser) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Check if target is already in the channel
        if (channel.hasMember(targetUser)) {
            this.sendReply(connection, IRC_REPLIES.ERR_USERONCHANNEL, `${targetNick} ${channelName} :is already on channel`);
            return;
        }

        // Send invite to target
        const inviterPrefix = inviter.getUserPrefix();
        targetUser.sendMessage(`:${inviterPrefix} INVITE ${targetNick} ${channelName}`);

        // Confirm to inviter (RPL_INVITING)
        this.sendReply(connection, '341', `${targetNick} ${channelName}`);

        // Broadcast INVITE to channel members with invite-notify capability
        this.broadcastInviteNotification(inviter, targetNick, channel);

        // Notify channel (optional - some servers do this)
        const schemaName = this.getSchemaFromChannel(channelName);
        const schemaInfo = schemaName ? ` (schema: ${schemaName})` : '';

        if (this.debug) {
            console.log(`💌 [${connection.id}] ${inviter.getNickname()} invited ${targetNick} to ${channelName}${schemaInfo}`);
        }
    }

    /**
     * Broadcast INVITE notification to channel members with invite-notify capability
     * Format: :inviter!user@host INVITE invitee #channel
     */
    private broadcastInviteNotification(inviter: any, targetNick: string, channel: any): void {
        const inviterPrefix = inviter.getUserPrefix();
        const channelName = channel.getName();
        const inviteMessage = `:${inviterPrefix} INVITE ${targetNick} ${channelName}`;

        // Get all channel members
        const members = channel.getMembers();

        for (const member of members) {
            // Skip the inviter (they already got confirmation)
            if (member === inviter) {
                continue;
            }

            // Only send to members with invite-notify capability
            if (member.hasCapability('invite-notify')) {
                member.sendMessage(inviteMessage);

                if (this.debug) {
                    const conn = member.getConnection();
                    console.log(`📢 [${conn?.id}] Notified ${member.getNickname()} of INVITE ${targetNick} to ${channelName}`);
                }
            }
        }
    }
}
