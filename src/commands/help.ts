/**
 * HELP command handler - Show available commands and usage
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class HelpCommand extends BaseIrcCommand {
    readonly name = 'HELP';
    readonly needsRegistration = false;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const topic = args.trim().toUpperCase();

        if (!topic) {
            this.sendGeneralHelp(connection);
        } else {
            this.sendTopicHelp(connection, topic);
        }
    }

    private sendGeneralHelp(connection: IrcConnection): void {
        this.sendReply(connection, IRC_REPLIES.RPL_HELPSTART, ':monk-irc Help System');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':monk-irc is a bridge between IRC protocol and monk-api');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Channels are monk-api schemas, messages are bridged operations');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Extended NICK formats:');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK alice!root@system    - Set nick, username, and tenant');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK root@system          - Use username as nick');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK alice                - Standard format (needs USER)');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Available Commands:');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  Connection: CAP NICK USER PING QUIT');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  Channels:   JOIN PART LIST NAMES TOPIC');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  Messaging:  PRIVMSG NOTICE');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  Management: KICK INVITE MODE');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  User Info:  WHOIS WHO ISON USERHOST AWAY');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  Server:     MOTD VERSION INFO TIME STATS ADMIN HELP');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':For detailed help: /HELP <command>');
        this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':For monk-api info: /INFO');
        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFHELP, ':End of /HELP');
    }

    private sendTopicHelp(connection: IrcConnection, topic: string): void {
        this.sendReply(connection, IRC_REPLIES.RPL_HELPSTART, `:Help for ${topic}`);

        switch (topic) {
            case 'NICK':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':NICK <nickname> - Set your IRC nickname');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Extended formats for monk-irc:');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK alice!root@system - Full format (nick!user@tenant)');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK root@system       - Short format (user@tenant)');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  NICK alice             - Standard IRC format');
                break;

            case 'JOIN':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':JOIN #channel - Join a channel (schema)');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Channels map to monk-api schemas:');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  JOIN #users              - Schema-level channel');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  JOIN #users/abc123       - Record-specific channel');
                break;

            case 'LIST':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':LIST - Show available channels (schemas from monk-api)');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Queries monk-api for schemas you have access to');
                break;

            case 'CAP':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':CAP <subcommand> - IRCv3 capability negotiation');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Available capabilities:');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  multi-prefix  - Standard IRC capability');
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':  tenant-aware  - Receive tenant lifecycle notifications');
                break;

            case 'INFO':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':INFO - Show server and API backend information');
                break;

            case 'STATS':
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':STATS - Show server statistics and tenant info');
                break;

            default:
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, `:No help available for ${topic}`);
                this.sendReply(connection, IRC_REPLIES.RPL_HELPTXT, ':Try /HELP for a list of commands');
                break;
        }

        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFHELP, ':End of /HELP');
    }
}
