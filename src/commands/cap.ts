/**
 * CAP command handler - IRCv3 Capability Negotiation
 *
 * Implements:
 * - CAP LS [version] - List available capabilities (multi-prefix, tenant-aware)
 * - CAP LIST - List enabled capabilities
 * - CAP REQ :cap1 cap2 - Request capabilities
 * - CAP END - End negotiation and resume registration
 *
 * The 'tenant-aware' capability enables tenant-scoped messaging:
 * - Receives TENANTS, TENANTJOIN, TENANTPART notifications
 * - Messages forwarded with #channel@tenant format
 * - Can send NOTICE with #channel@tenant routing
 */

import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection, ServerConfig } from '../lib/types.js';
import { IRC_REPLIES } from '../lib/types.js';

export class CapCommand extends BaseIrcCommand {
    readonly name = 'CAP';
    readonly needsRegistration = false;

    // Available capabilities
    private readonly AVAILABLE_CAPABILITIES = new Set([
        'multi-prefix',
        'tenant-aware'
    ]);

    constructor(config: ServerConfig, private server: any) {
        super(config);
    }

    async execute(connection: IrcConnection, args: string): Promise<void> {
        const parts = args.trim().split(/\s+/);
        const subcommand = parts[0]?.toUpperCase();

        if (!subcommand) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'CAP :Not enough parameters');
            return;
        }

        switch (subcommand) {
            case 'LS':
                await this.handleLS(connection, parts.slice(1));
                break;
            case 'LIST':
                await this.handleLIST(connection);
                break;
            case 'REQ':
                await this.handleREQ(connection, parts.slice(1).join(' '));
                break;
            case 'END':
                await this.handleEND(connection);
                break;
            default:
                this.sendReply(connection, IRC_REPLIES.ERR_UNKNOWNCOMMAND, `CAP ${subcommand} :Unknown CAP subcommand`);
        }
    }

    /**
     * CAP LS [version] - List available capabilities
     */
    private async handleLS(connection: IrcConnection, args: string[]): Promise<void> {
        // Begin CAP negotiation
        connection.capNegotiating = true;

        const version = args[0];
        const caps = Array.from(this.AVAILABLE_CAPABILITIES).join(' ');

        // Format: :server CAP * LS :cap1 cap2 cap3
        this.sendMessage(connection, `:${this.serverName} CAP * LS :${caps}`);

        if (this.debug) {
            console.log(`🔧 [${connection.id}] CAP LS ${version || ''} - sent available capabilities`);
        }
    }

    /**
     * CAP LIST - List currently enabled capabilities
     */
    private async handleLIST(connection: IrcConnection): Promise<void> {
        const caps = Array.from(connection.capabilities).join(' ');

        // Format: :server CAP * LIST :cap1 cap2
        this.sendMessage(connection, `:${this.serverName} CAP * LIST :${caps}`);

        if (this.debug) {
            console.log(`🔧 [${connection.id}] CAP LIST - sent enabled capabilities: ${caps || '(none)'}`);
        }
    }

    /**
     * CAP REQ :cap1 cap2 - Request capabilities
     */
    private async handleREQ(connection: IrcConnection, args: string): Promise<void> {
        // Remove leading colon if present
        let capsString = args.trim();
        if (capsString.startsWith(':')) {
            capsString = capsString.substring(1);
        }

        const requestedCaps = capsString.split(/\s+/).filter(c => c.length > 0);

        if (requestedCaps.length === 0) {
            this.sendReply(connection, IRC_REPLIES.ERR_NEEDMOREPARAMS, 'CAP REQ :Not enough parameters');
            return;
        }

        // Check if all requested capabilities are available
        const unavailableCaps = requestedCaps.filter(cap => !this.AVAILABLE_CAPABILITIES.has(cap));

        if (unavailableCaps.length > 0) {
            // NAK - reject the request
            this.sendMessage(connection, `:${this.serverName} CAP * NAK :${requestedCaps.join(' ')}`);

            if (this.debug) {
                console.log(`🔧 [${connection.id}] CAP REQ NAK - unavailable: ${unavailableCaps.join(', ')}`);
            }
            return;
        }

        // ACK - accept all requested capabilities
        for (const cap of requestedCaps) {
            connection.capabilities.add(cap);
        }

        // Check for tenant-aware capability
        if (requestedCaps.includes('tenant-aware')) {
            connection.isTenantAware = true;

            // Register as tenant-aware connection
            this.server.addTenantAwareConnection(connection);

            if (this.debug) {
                console.log(`🤖 [${connection.id}] Tenant-aware capability enabled`);
            }

            // Send TENANTS message after ACK
            await this.sendTenantsList(connection);
        }

        // Send ACK
        this.sendMessage(connection, `:${this.serverName} CAP * ACK :${requestedCaps.join(' ')}`);

        if (this.debug) {
            console.log(`🔧 [${connection.id}] CAP REQ ACK - enabled: ${requestedCaps.join(', ')}`);
        }
    }

    /**
     * CAP END - End capability negotiation and resume registration
     */
    private async handleEND(connection: IrcConnection): Promise<void> {
        connection.capNegotiating = false;

        if (this.debug) {
            console.log(`🔧 [${connection.id}] CAP END - negotiation complete, resuming registration`);
        }

        // Check if registration can now complete
        // Registration needs: nickname, username, jwt, and NOT capNegotiating
        if (connection.nickname && connection.username && connection.jwt && !connection.registered) {
            await this.completeRegistration(connection);
        }
    }

    /**
     * Send TENANTS message to tenant-aware connection
     * Format: :server TENANTS <botnick> :<tenant1>,<tenant2>,<tenant3>
     */
    private async sendTenantsList(connection: IrcConnection): Promise<void> {
        const tenants = this.server.getActiveTenants();
        const tenantNames = tenants
            .map((t: any) => t.name)
            .filter((name: string) => name !== undefined)
            .join(',');

        const nick = connection.nickname || '*';
        this.sendMessage(connection, `:${this.serverName} ${IRC_REPLIES.TENANTS} ${nick} :${tenantNames}`);

        if (this.debug) {
            console.log(`🤖 [${connection.id}] Sent TENANTS list: ${tenantNames || '(none)'}`);
        }
    }
}
