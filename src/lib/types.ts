/**
 * Shared types for monk-irc server
 */

import type * as net from 'net';

export interface IrcConnection {
    socket: net.Socket;
    id: string;

    // Registration state
    nickname?: string;
    username?: string;
    realname?: string;
    hostname: string;
    registered: boolean;

    // Authentication (optional)
    authenticated: boolean;
    jwtToken?: string;

    // Channel membership (in-memory for routing)
    channels: Set<string>;  // #channel-name

    // User modes
    modes: Set<string>;     // +i, +w, etc.

    // Connection metadata
    connectedAt: Date;
    lastActivity: Date;
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
    apiUrl: string;          // http://localhost:9001
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

    // WHOIS replies
    RPL_WHOISUSER: '311',         // User info
    RPL_ENDOFWHOIS: '318',        // End of WHOIS

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
    ERR_NOTREGISTERED: '451',     // Not registered
    ERR_NEEDMOREPARAMS: '461',    // Need more params
    ERR_ALREADYREGISTERED: '462', // Already registered
} as const;
