/**
 * STATS command handler - Server statistics
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class StatsCommand extends BaseIrcCommand {
    readonly name = 'STATS';
    readonly needsRegistration = true;

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const query = args.trim().toLowerCase();

        // Get server statistics
        const stats = this.server.getServerStats();

        if (!query || query === 'u') {
            // STATS u - Server uptime and general stats
            this.sendReply(connection, IRC_REPLIES.RPL_STATSUPTIME, `:Server up since startup`);
            this.sendReply(connection, IRC_REPLIES.RPL_STATSUPTIME, `:Total connections: ${stats.totalConnections}`);
            this.sendReply(connection, IRC_REPLIES.RPL_STATSUPTIME, `:Total tenants: ${stats.totalTenants}`);
        }

        if (!query || query === 'c') {
            // STATS c - Connection statistics per tenant
            this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE, ':');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE, ':Tenant Statistics:');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE, ':----------------------------------------');

            if (stats.tenants && stats.tenants.length > 0) {
                for (const tenant of stats.tenants) {
                    const name = tenant.name || 'unknown';
                    const connections = tenant.connections || 0;
                    const channels = tenant.channels || 0;

                    this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE,
                        `:Tenant: ${name.padEnd(20)} Connections: ${connections.toString().padEnd(3)} Channels: ${channels}`);
                }
            } else {
                this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE, ':No active tenants');
            }
            this.sendReply(connection, IRC_REPLIES.RPL_STATSCLINE, ':----------------------------------------');
        }

        if (!query || query === 'l') {
            // STATS l - Link/connection info (show current tenant info)
            if (connection.tenant) {
                const tenant = this.server.getTenant(connection.tenant);
                const tenantStats = tenant.getStats();

                this.sendReply(connection, IRC_REPLIES.RPL_STATSLINKINFO, ':');
                this.sendReply(connection, IRC_REPLIES.RPL_STATSLINKINFO, `:Your Tenant: ${connection.tenant}`);
                this.sendReply(connection, IRC_REPLIES.RPL_STATSLINKINFO, `:  Connections: ${tenantStats.connections}`);
                this.sendReply(connection, IRC_REPLIES.RPL_STATSLINKINFO, `:  Active Channels: ${tenantStats.channels}`);

                if (tenantStats.channelList && tenantStats.channelList.length > 0) {
                    this.sendReply(connection, IRC_REPLIES.RPL_STATSLINKINFO, `:  Channels: ${tenantStats.channelList.join(', ')}`);
                }
            }
        }

        if (!query) {
            this.sendReply(connection, IRC_REPLIES.RPL_STATSLINE, ':');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSLINE, ':Available STATS queries:');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSLINE, ':  /STATS u - Server uptime and general statistics');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSLINE, ':  /STATS c - Tenant connection statistics');
            this.sendReply(connection, IRC_REPLIES.RPL_STATSLINE, ':  /STATS l - Current tenant information');
        }

        this.sendReply(connection, IRC_REPLIES.RPL_ENDOFSTATS, `${query || '*'} :End of /STATS report`);
    }
}
