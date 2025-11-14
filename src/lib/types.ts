/**
 * Shared types for monk-irc server
 */

import type * as net from 'net';

// Export domain classes
export { Channel, ChannelMode, type ChannelTopicInfo } from './channel.js';
export { User } from './user.js';
export { Tenant } from './tenant.js';

export interface IrcConnection {
    socket: net.Socket;
    id: string;

    // IRC Identity
    nickname?: string;
    username?: string;        // API username
    realname?: string;
    hostname: string;
    registered: boolean;

    // monk-api Authentication (per-user)
    tenant?: string;          // API tenant name
    serverName?: string;      // API server identifier (dev/testing/prod)
    apiUrl?: string;          // Resolved API URL
    jwt?: string;             // JWT from POST /auth/login

    // Channel membership (in-memory for routing)
    channels: Set<string>;  // #channel-name

    // User modes
    modes: Set<string>;     // +i, +w, etc.

    // User status
    awayMessage?: string;   // Away message (undefined if not away)

    // Connection metadata
    connectedAt: Date;
    lastActivity: Date;

    // Line buffer for IRC protocol parsing
    lineBuffer: string;

    // CAP Negotiation (IRCv3)
    capNegotiating: boolean;           // true during CAP negotiation, blocks registration
    capabilities: Set<string>;         // enabled capabilities (e.g., 'tenant-aware')
    isTenantAware: boolean;            // true if tenant-aware capability enabled
}

export interface IrcCommandHandler {
    readonly name: string;
    readonly needsRegistration: boolean;

    execute(connection: IrcConnection, args: string): Promise<void>;
}

export interface ServerConfig {
    port: number;
    host: string;
    serverName: string;      // irc.monk.local
    apiUrl: string;          // monk-api backend URL (single server)
    debug: boolean;
}

export interface IrcResponse {
    code: string;
    message: string;
}

// IRC Numeric Replies (RFC 1459/2812)
export const IRC_REPLIES = {
    // Welcome messages (001-004)
    RPL_WELCOME: '001',           // Welcome to the network
    RPL_YOURHOST: '002',          // Your host is...
    RPL_CREATED: '003',           // Server created...
    RPL_MYINFO: '004',            // Server info

    // Channel operations
    RPL_LISTSTART: '321',         // Start of LIST
    RPL_LIST: '322',              // Channel list entry
    RPL_LISTEND: '323',           // End of LIST
    RPL_NOTOPIC: '331',           // No topic set
    RPL_TOPIC: '332',             // Channel topic
    RPL_NAMREPLY: '353',          // Names list
    RPL_ENDOFNAMES: '366',        // End of names

    // MOTD replies
    RPL_MOTDSTART: '375',         // Start of MOTD
    RPL_MOTD: '372',              // MOTD line
    RPL_ENDOFMOTD: '376',         // End of MOTD

    // WHOIS replies
    RPL_WHOISUSER: '311',         // User info
    RPL_ENDOFWHOIS: '318',        // End of WHOIS

    // AWAY replies
    RPL_AWAY: '301',              // User is away
    RPL_UNAWAY: '305',            // You are no longer marked as away
    RPL_NOWAWAY: '306',           // You are now marked as away

    // ISON reply
    RPL_ISON: '303',              // ISON reply

    // VERSION reply
    RPL_VERSION: '351',           // Server version

    // TIME reply
    RPL_TIME: '391',              // Server time

    // INFO replies
    RPL_INFO: '371',              // Info line
    RPL_ENDOFINFO: '374',         // End of INFO

    // STATS replies
    RPL_STATSLINE: '210',         // Generic stats line
    RPL_STATSUPTIME: '242',       // Server uptime
    RPL_STATSCLINE: '213',        // Connection stats
    RPL_STATSLINKINFO: '211',     // Link info
    RPL_ENDOFSTATS: '219',        // End of STATS

    // ADMIN replies
    RPL_ADMINME: '256',           // Admin info
    RPL_ADMINLOC1: '257',         // Admin location 1
    RPL_ADMINLOC2: '258',         // Admin location 2
    RPL_ADMINEMAIL: '259',        // Admin email

    // USERHOST reply
    RPL_USERHOST: '302',          // Userhost response

    // HELP replies
    RPL_HELPSTART: '704',         // Start of help
    RPL_HELPTXT: '705',           // Help text
    RPL_ENDOFHELP: '706',         // End of help

    // Tenant-aware commands (custom, not standard IRC numerics)
    TENANTS: 'TENANTS',           // Initial tenant list for tenant-aware connections
    TENANTJOIN: 'TENANTJOIN',     // New tenant connected (first user)
    TENANTPART: 'TENANTPART',     // Tenant disconnected (last user)

    // LINKS replies
    RPL_LINKS: '364',             // Server link
    RPL_ENDOFLINKS: '365',        // End of LINKS

    // Errors
    ERR_NOSUCHNICK: '401',        // No such nick/channel
    ERR_NOSUCHCHANNEL: '403',     // No such channel
    ERR_CANNOTSENDTOCHAN: '404',  // Cannot send to channel
    ERR_TOOMANYCHANNELS: '405',   // Too many channels
    ERR_NORECIPIENT: '411',       // No recipient
    ERR_NOTEXTTOSEND: '412',      // No text to send
    ERR_UNKNOWNCOMMAND: '421',    // Unknown command
    ERR_NONICKNAMEGIVEN: '431',   // No nickname given
    ERR_ERRONEUSNICKNAME: '432',  // Erroneous nickname
    ERR_NICKNAMEINUSE: '433',     // Nickname in use
    ERR_USERNOTINCHANNEL: '441',  // User not in channel
    ERR_NOTONCHANNEL: '442',      // Not on channel
    ERR_USERONCHANNEL: '443',     // User already on channel
    ERR_NOTREGISTERED: '451',     // Not registered
    ERR_NEEDMOREPARAMS: '461',    // Need more params
    ERR_ALREADYREGISTERED: '462', // Already registered
    ERR_NOPRIVILEGES: '481',      // No privileges (for operator commands)
    ERR_CHANOPRIVSNEEDED: '482',  // Channel operator privileges needed
    ERR_NOOPERHOST: '491',        // No operator host
} as const;
