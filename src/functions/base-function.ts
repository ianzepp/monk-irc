/**
 * Base class for in-channel functions (bot commands)
 * Functions are invoked with ! prefix in channels
 */

import type { IrcConnection, ServerConfig } from '../lib/types.js';

export abstract class BaseFunction {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly usage: string;
    abstract readonly requiresSchema: boolean;

    protected readonly debug: boolean;

    constructor(protected config: ServerConfig, protected server: any) {
        this.debug = config.debug || false;
    }

    /**
     * Make API request on behalf of user
     */
    protected async apiRequest(
        connection: IrcConnection,
        path: string,
        options?: RequestInit
    ): Promise<Response> {
        const url = `${connection.apiUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${connection.jwt}`,
            'Content-Type': 'application/json',
            ...options?.headers
        };

        return fetch(url, {
            ...options,
            headers
        });
    }

    /**
     * Execute the function
     * @param sender User who invoked the function
     * @param channel Channel where function was invoked
     * @param args Arguments passed to function (split by whitespace)
     */
    abstract executeFunction(
        sender: any,
        channel: any,
        args: string[]
    ): Promise<void>;

    /**
     * Send NOTICE to entire channel
     */
    protected sendNotice(channel: any, message: string): void {
        channel.broadcast(`:server NOTICE ${channel.getName()} :${message}`);
    }

    /**
     * Send NOTICE only to the sender (visible in channel context)
     */
    protected sendNoticeToSender(sender: any, channel: any, message: string): void {
        sender.sendMessage(`:server NOTICE ${channel.getName()} :${message}`);
    }

    /**
     * Format a record for display
     */
    protected formatRecord(record: any, fields?: string[]): string {
        if (fields && fields.length > 0) {
            const parts: string[] = [];
            for (const field of fields) {
                if (record[field] !== undefined) {
                    parts.push(`${field}=${record[field]}`);
                }
            }
            return parts.join(', ');
        }

        // Default formatting
        const id = record.id || record._id || record.username || record.name;
        const label = record.name || record.title || record.label || '';
        return label ? `${id}: ${label}` : id;
    }
}
