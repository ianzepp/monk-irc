/**
 * Tenant - Encapsulates all state for a single tenant
 *
 * Provides complete isolation: channels, members, and connections
 * are scoped per tenant, preventing cross-tenant data leakage.
 */

import type { IrcConnection } from './types.js';

export class Tenant {
    // Tenant identifier
    public readonly name: string;

    // Channel membership: channel name → set of connections
    private channelMembers = new Map<string, Set<IrcConnection>>();

    // All active connections for this tenant
    private connections = new Set<IrcConnection>();

    // In-memory channel topics (channel name → topic string)
    private channelTopics = new Map<string, string>();

    // Tenant metadata
    private createdAt: Date;
    private lastActivity: Date;

    constructor(name: string) {
        this.name = name;
        this.createdAt = new Date();
        this.lastActivity = new Date();
    }

    // Connection management

    public addConnection(connection: IrcConnection): void {
        this.connections.add(connection);
        this.updateActivity();
    }

    public removeConnection(connection: IrcConnection): void {
        this.connections.delete(connection);

        // Remove from all channels
        for (const channelName of connection.channels) {
            this.removeFromChannel(connection, channelName);
        }

        this.updateActivity();
    }

    public getConnections(): IrcConnection[] {
        return Array.from(this.connections);
    }

    public getConnectionCount(): number {
        return this.connections.size;
    }

    // Channel management

    public addToChannel(connection: IrcConnection, channelName: string): void {
        if (!this.channelMembers.has(channelName)) {
            this.channelMembers.set(channelName, new Set());
        }

        const members = this.channelMembers.get(channelName)!;
        members.add(connection);
        connection.channels.add(channelName);

        this.updateActivity();
    }

    public removeFromChannel(connection: IrcConnection, channelName: string): void {
        const members = this.channelMembers.get(channelName);
        if (members) {
            members.delete(connection);

            // Clean up empty channels
            if (members.size === 0) {
                this.channelMembers.delete(channelName);
            }
        }

        connection.channels.delete(channelName);
        this.updateActivity();
    }

    public getChannelMembers(channelName: string): IrcConnection[] {
        const members = this.channelMembers.get(channelName);
        return members ? Array.from(members) : [];
    }

    public getActiveChannels(): Set<string> {
        return new Set(this.channelMembers.keys());
    }

    public isChannelActive(channelName: string): boolean {
        return this.channelMembers.has(channelName);
    }

    public broadcastToChannel(
        channelName: string,
        message: string,
        excludeConnection?: IrcConnection
    ): void {
        const members = this.channelMembers.get(channelName);
        if (!members) return;

        for (const member of members) {
            if (member !== excludeConnection) {
                member.socket.write(`${message}\r\n`);
            }
        }
    }

    // Topic management

    public setChannelTopic(channelName: string, topic: string): void {
        this.channelTopics.set(channelName, topic);
        this.updateActivity();
    }

    public getChannelTopic(channelName: string): string | undefined {
        return this.channelTopics.get(channelName);
    }

    public hasChannelTopic(channelName: string): boolean {
        return this.channelTopics.has(channelName);
    }

    public clearChannelTopic(channelName: string): void {
        this.channelTopics.delete(channelName);
        this.updateActivity();
    }

    // Metadata

    private updateActivity(): void {
        this.lastActivity = new Date();
    }

    public getStats() {
        return {
            name: this.name,
            connections: this.connections.size,
            channels: this.channelMembers.size,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity
        };
    }

    // Cleanup check - can tenant be removed?
    public isEmpty(): boolean {
        return this.connections.size === 0;
    }
}
