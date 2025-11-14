/**
 * INFO command handler - Extended server information
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class InfoCommand extends BaseIrcCommand {
    readonly name = 'INFO';
    readonly needsRegistration = true;

    constructor(config: ServerConfig) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        // Send INFO responses
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':============================================');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':monk-irc - IRC Protocol Bridge to monk-api');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':============================================');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');

        // Server info
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:Server: ${this.serverName}`);
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:Version: monk-irc 1.0.0`);
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');

        // Connection info
        if (connection.tenant && connection.username) {
            this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':Your Connection:');
            this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  Tenant:   ${connection.tenant}`);
            this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  Username: ${connection.username}`);
            this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  Nickname: ${connection.nickname || 'not set'}`);
            this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');
        }

        // API backend info
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':API Backend:');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  URL: ${connection.apiUrl || this.config.apiUrl}`);

        // Check API health if connected
        if (connection.apiUrl && connection.jwt) {
            try {
                const response = await this.apiRequest(connection, '/api/health');
                if (response.ok) {
                    const health = await response.json() as { status?: string };
                    this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  Status: ${health.status || 'ok'}`);
                } else {
                    this.sendReply(connection, IRC_REPLIES.RPL_INFO, `:  Status: Error (${response.status})`);
                }
            } catch (error) {
                this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Status: Unreachable');
            }
        }

        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');

        // Architecture info
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':Architecture:');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Type: Stateless bridge (no persistence)');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Channels: Map to monk-api schemas');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Authentication: Per-connection JWT from monk-api');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Tenant Isolation: Complete separation per tenant');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');

        // Extended features
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':Extended Features:');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  NICK formats: alice!root@system, root@system');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  Channel types: #schema, #schema/recordId');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':  IRCv3 CAP: multi-prefix, tenant-aware');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':');

        // Help
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':For help: /HELP');
        this.sendReply(connection, IRC_REPLIES.RPL_INFO, ':For statistics: /STATS');

        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFINFO, ':End of /INFO');
    }
}
