/**
 * MODE command handler - Get/set user and channel modes
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class ModeCommand extends BaseIrcCommand {
    readonly name = 'MODE';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.trim().split(' ');
        const target = parts[0];

        if (!target) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'MODE :Not enough parameters');
            return;
        }

        if (this.debug) {
            console.log(`⚙️  [${connection.id}] ${connection.nickname} MODE command: ${args}`);
        }

        // Check if it's a channel or user mode
        if (target.startsWith('#')) {
            await this.handleChannelMode(connection, target, parts.slice(1));
        } else {
            await this.handleUserMode(connection, target, parts.slice(1));
        }
    }

    private async handleChannelMode(connection: IrcConnection, channelName: string, modeParts: string[]): Promise<void> {
        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
            return;
        }

        // Check if user is in the channel
        if (!connection.channels.has(channelName)) {
            this.sendReply(connection, IRC_REPLIES.ERR_NOTONCHANNEL, `${channelName} :You're not on that channel`);
            return;
        }

        try {
            // Get channel from database
            const channels = await this.apiClient.findChannelByName(channelName, this.apiToken);
            if (!channels || channels.length === 0) {
                this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :No such channel`);
                return;
            }

            const channel = channels[0];

            if (modeParts.length === 0) {
                // Query mode - return current channel modes
                // RPL_CHANNELMODEIS (324): "<channel> <mode> <mode params>"
                const modes = channel.modes || '+nt';
                this.sendReply(connection, '324', `${channelName} ${modes}`);
                
                // RPL_CREATIONTIME (329): "<channel> <creation time>"
                const creationTime = channel.created_at ? Math.floor(new Date(channel.created_at).getTime() / 1000) : 0;
                this.sendReply(connection, '329', `${channelName} ${creationTime}`);
            } else {
                // Setting mode - for now, just acknowledge but don't actually change
                // This would require operator status checking in a full implementation
                const modeString = modeParts.join(' ');
                
                // Just send back the mode change as if it succeeded
                // In a full implementation, we'd parse +/-modes and validate operator status
                this.sendMessage(connection, `:${this.getUserPrefix(connection)} MODE ${channelName} ${modeString}`);
                
                if (this.debug) {
                    console.log(`⚙️  [${connection.id}] Channel mode change requested: ${channelName} ${modeString}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to handle channel mode for ${channelName}:`, error);
            this.sendReply(connection, IRC_REPLIES.ERR_NOSUCHCHANNEL, `${channelName} :Cannot get/set mode`);
        }
    }

    private async handleUserMode(connection: IrcConnection, nickname: string, modeParts: string[]): Promise<void> {
        // Users can only set modes for themselves
        if (nickname !== connection.nickname) {
            this.sendReply(connection, '502', ":Can't change mode for other users");
            return;
        }

        if (modeParts.length === 0) {
            // Query mode - return current user modes
            // RPL_UMODEIS (221): "<user mode string>"
            const modes = connection.modes.size > 0 
                ? '+' + Array.from(connection.modes).join('') 
                : '+';
            this.sendReply(connection, '221', modes);
        } else {
            // Setting mode
            const modeString = modeParts[0];
            let adding = true;
            
            for (const char of modeString) {
                if (char === '+') {
                    adding = true;
                } else if (char === '-') {
                    adding = false;
                } else {
                    // Simple mode characters: i (invisible), w (wallops)
                    if (adding) {
                        connection.modes.add(char);
                    } else {
                        connection.modes.delete(char);
                    }
                }
            }

            // Acknowledge the mode change
            this.sendMessage(connection, `:${connection.nickname} MODE ${connection.nickname} ${modeString}`);

            if (this.debug) {
                console.log(`⚙️  [${connection.id}] User mode changed: ${modeString} -> ${Array.from(connection.modes).join('')}`);
            }
        }
    }
}
