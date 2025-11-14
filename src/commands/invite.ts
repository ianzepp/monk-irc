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

        // Check if inviter is in the channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        // Find target user
        const targetConnection = this.server.getConnectionByNickname(targetNick);
        if (!targetConnection) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Check if target is in the same tenant
        if (targetConnection.tenant !== connection.tenant) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHNICK, `${targetNick} :No such nick`);
            return;
        }

        // Check if target is already in the channel
        if (targetConnection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_USERONCHANNEL, `${targetNick} ${channelName} :is already on channel`);
            return;
        }

        // Send invite to target
        targetConnection.socket.write(`:${this.getUserPrefix(connection)} INVITE ${targetNick} ${channelName}\r\n`);

        // Confirm to inviter (RPL_INVITING)
        this.sendReply(connection, '341', `${targetNick} ${channelName}`);

        // Broadcast INVITE to channel members with invite-notify capability
        this.broadcastInviteNotification(connection, targetNick, channelName);

        // Notify channel (optional - some servers do this)
        const schemaName = this.getSchemaFromChannel(channelName);
        const schemaInfo = schemaName ? ` (schema: ${schemaName})` : '';

        if (this.debug) {
            console.log(`💌 [${connection.id}] ${connection.nickname} invited ${targetNick} to ${channelName}${schemaInfo}`);
        }
    }

    /**
     * Broadcast INVITE notification to channel members with invite-notify capability
     * Format: :inviter!user@host INVITE invitee #channel
     */
    private broadcastInviteNotification(inviter: IrcConnection, targetNick: string, channelName: string): void {
        const inviterPrefix = this.getUserPrefix(inviter);
        const inviteMessage = `:${inviterPrefix} INVITE ${targetNick} ${channelName}`;

        // Get all channel members
        const members = this.server.getChannelMembers(inviter, channelName);

        for (const member of members) {
            // Skip the inviter (they already got confirmation)
            if (member.id === inviter.id) {
                continue;
            }

            // Only send to members with invite-notify capability
            if (member.capabilities.has('invite-notify')) {
                this.sendMessage(member, inviteMessage);

                if (this.debug) {
                    console.log(`📢 [${member.id}] Notified ${member.nickname} of INVITE ${targetNick} to ${channelName}`);
                }
            }
        }
    }
}
