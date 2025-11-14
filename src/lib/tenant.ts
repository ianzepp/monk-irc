/**
 * Tenant - Encapsulates all state for a single tenant
 *
 * Provides complete isolation: channels, members, and connections
 * are scoped per tenant, preventing cross-tenant data leakage.
 */

import type { IrcConnection } from './types.js';
import { Channel } from './channel.js';
import type { User } from './user.js';

export class Tenant {
    // Tenant identifier
    public readonly name: string;

    // Channel registry: channel name → Channel object
    private channels = new Map<string, Channel>();

    // User registry: user ID → User object
    private users = new Map<string, User>();

    // Connection registry: connection ID → User object (for quick lookup)
    private connectionToUser = new Map<string, User>();

    // Tenant metadata
    private createdAt: Date;
    private lastActivity: Date;

    constructor(name: string) {
        this.name = name;
        this.createdAt = new Date();
        this.lastActivity = new Date();
    }

    // ===== User Management =====

    public addUser(user: User): void {
        this.users.set(user.getId(), user);
        const connection = user.getConnection();
        if (connection) {
            this.connectionToUser.set(connection.id, user);
        }
        this.updateActivity();
    }

    public removeUser(user: User): void {
        // Remove user from all channels
        for (const channel of user.getChannels()) {
            channel.removeMember(user);
            // Clean up empty channels
            if (channel.isEmpty()) {
                this.channels.delete(channel.getName());
            }
        }

        this.users.delete(user.getId());
        const connection = user.getConnection();
        if (connection) {
            this.connectionToUser.delete(connection.id);
        }
        this.updateActivity();
    }

    public getUserByConnection(connection: IrcConnection): User | undefined {
        return this.connectionToUser.get(connection.id);
    }

    public getUserByNickname(nickname: string): User | undefined {
        for (const user of this.users.values()) {
            if (user.getNickname() === nickname) {
                return user;
            }
        }
        return undefined;
    }

    public getUserById(userId: string): User | undefined {
        return this.users.get(userId);
    }

    public getUsers(): User[] {
        return Array.from(this.users.values());
    }

    public getUserCount(): number {
        return this.users.size;
    }

    // ===== Legacy Connection Methods (for backward compatibility) =====

    public addConnection(connection: IrcConnection): void {
        // This is now handled by addUser
        // Keep for backward compatibility during migration
        const user = this.connectionToUser.get(connection.id);
        if (user) {
            user.setConnection(connection);
        }
        this.updateActivity();
    }

    public removeConnection(connection: IrcConnection): void {
        const user = this.connectionToUser.get(connection.id);
        if (user) {
            this.removeUser(user);
        }
        this.updateActivity();
    }

    public getConnections(): IrcConnection[] {
        const connections: IrcConnection[] = [];
        for (const user of this.users.values()) {
            const conn = user.getConnection();
            if (conn) {
                connections.push(conn);
            }
        }
        return connections;
    }

    public getConnectionCount(): number {
        return this.connectionToUser.size;
    }

    // ===== Channel Management =====

    public getOrCreateChannel(channelName: string, createdBy: string): Channel {
        let channel = this.channels.get(channelName);
        if (!channel) {
            channel = new Channel(channelName, this, createdBy);
            this.channels.set(channelName, channel);
            this.updateActivity();
        }
        return channel;
    }

    public getChannel(channelName: string): Channel | undefined {
        return this.channels.get(channelName);
    }

    public hasChannel(channelName: string): boolean {
        return this.channels.has(channelName);
    }

    public getChannels(): Channel[] {
        return Array.from(this.channels.values());
    }

    public getChannelNames(): string[] {
        return Array.from(this.channels.keys());
    }

    public removeChannel(channelName: string): void {
        this.channels.delete(channelName);
        this.updateActivity();
    }

    // ===== Legacy Channel Methods (for backward compatibility) =====

    public addToChannel(connection: IrcConnection, channelName: string): void {
        const user = this.connectionToUser.get(connection.id);
        if (!user) return;

        const channel = this.getOrCreateChannel(channelName, user.getNickname());
        channel.addMember(user);
        user.joinChannel(channel);
        this.updateActivity();
    }

    public removeFromChannel(connection: IrcConnection, channelName: string): void {
        const user = this.connectionToUser.get(connection.id);
        if (!user) return;

        const channel = this.channels.get(channelName);
        if (!channel) return;

        channel.removeMember(user);
        user.partChannel(channel);

        // Clean up empty channels
        if (channel.isEmpty()) {
            this.channels.delete(channelName);
        }

        this.updateActivity();
    }

    public getChannelMembers(channelName: string): IrcConnection[] {
        const channel = this.channels.get(channelName);
        if (!channel) return [];

        const connections: IrcConnection[] = [];
        for (const user of channel.getMembers()) {
            const conn = user.getConnection();
            if (conn) {
                connections.push(conn);
            }
        }
        return connections;
    }

    public getActiveChannels(): Set<string> {
        return new Set(this.channels.keys());
    }

    public isChannelActive(channelName: string): boolean {
        return this.channels.has(channelName);
    }

    public broadcastToChannel(
        channelName: string,
        message: string,
        excludeConnection?: IrcConnection
    ): void {
        const channel = this.channels.get(channelName);
        if (!channel) return;

        let excludeUser: User | undefined;
        if (excludeConnection) {
            excludeUser = this.connectionToUser.get(excludeConnection.id);
        }

        channel.broadcast(message, excludeUser);
    }

    // ===== Topic Management (delegated to Channel) =====

    public setChannelTopic(channelName: string, topic: string): void {
        const channel = this.channels.get(channelName);
        if (channel) {
            // Note: setBy is not tracked here, should be passed from command handler
            channel.setTopic(topic, 'unknown');
            this.updateActivity();
        }
    }

    public getChannelTopic(channelName: string): string | undefined {
        const channel = this.channels.get(channelName);
        return channel?.getTopic();
    }

    public hasChannelTopic(channelName: string): boolean {
        const channel = this.channels.get(channelName);
        return channel?.getTopic() !== undefined;
    }

    public clearChannelTopic(channelName: string): void {
        const channel = this.channels.get(channelName);
        if (channel) {
            channel.clearTopic();
            this.updateActivity();
        }
    }

    // ===== Metadata =====

    public getName(): string {
        return this.name;
    }

    private updateActivity(): void {
        this.lastActivity = new Date();
    }

    public getStats() {
        return {
            name: this.name,
            users: this.users.size,
            connections: this.connectionToUser.size,
            channels: this.channels.size,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity
        };
    }

    // Cleanup check - can tenant be removed?
    public isEmpty(): boolean {
        return this.users.size === 0;
    }
}
