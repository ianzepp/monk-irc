/**
 * Shared types for monk-irc server
 */

import type * as net from 'net';

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
    apiServers: Map<string, string>;  // serverName → API URL mapping
    defaultServer: string;   // Default API server identifier
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

    // Tenant-aware commands (custom, not standard IRC numerics)
    TENANTS: 'TENANTS',           // Initial tenant list for tenant-aware connections
    TENANTJOIN: 'TENANTJOIN',     // New tenant connected (first user)
    TENANTPART: 'TENANTPART',     // Tenant disconnected (last user)

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
    ERR_CHANOPRIVSNEEDED: '482',  // Channel operator privileges needed
} as const;
