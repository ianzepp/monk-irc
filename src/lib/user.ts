/**
 * User class - Encapsulates IRC user identity and state
 */

import type { IrcConnection } from './types.js';
import type { Tenant } from './tenant.js';
import type { Channel } from './channel.js';

export class User {
    private id: string;
    private nickname: string;
    private username: string;
    private realname: string;
    private tenant: Tenant;

    private connection?: IrcConnection;
    private channels = new Set<Channel>();
    private modes = new Set<string>();
    private awayMessage?: string;
    private capabilities = new Set<string>();

    private jwt?: string;
    private apiUrl?: string;
    private serverName?: string;

    private readonly createdAt: Date;
    private lastActivity: Date;
    private nicknameHistory: Array<{ nick: string; timestamp: Date }> = [];

    constructor(
        username: string,
        tenant: Tenant,
        nickname: string,
        realname: string
    ) {
        this.username = username;
        this.tenant = tenant;
        this.nickname = nickname;
        this.realname = realname;
        this.id = `${tenant.getName()}:${username}`;
        this.createdAt = new Date();
        this.lastActivity = new Date();

        // Record initial nickname
        this.nicknameHistory.push({
            nick: nickname,
            timestamp: new Date()
        });
    }

    // ===== Identity =====

    getNickname(): string {
        return this.nickname;
    }

    setNickname(newNick: string): void {
        if (newNick !== this.nickname) {
            this.nicknameHistory.push({
                nick: newNick,
                timestamp: new Date()
            });
            this.nickname = newNick;
        }
    }

    getUsername(): string {
        return this.username;
    }

    getRealname(): string {
        return this.realname;
    }

    setRealname(realname: string): void {
        this.realname = realname;
    }

    getUserPrefix(): string {
        const hostname = this.connection?.hostname || 'unknown';
        return `${this.nickname}!${this.username}@${hostname}`;
    }

    getId(): string {
        return this.id;
    }

    getHostname(): string {
        return this.connection?.hostname || 'unknown';
    }

    // ===== Connection Management =====

    setConnection(connection: IrcConnection): void {
        this.connection = connection;
        this.updateActivity();
    }

    getConnection(): IrcConnection | undefined {
        return this.connection;
    }

    isConnected(): boolean {
        return this.connection !== undefined && !this.connection.socket.destroyed;
    }

    disconnect(): void {
        if (this.connection) {
            this.connection.socket.end();
            this.connection = undefined;
        }
    }

    isRegistered(): boolean {
        return this.connection?.registered || false;
    }

    setRegistered(registered: boolean): void {
        if (this.connection) {
            this.connection.registered = registered;
        }
    }

    // ===== Channel Management =====

    joinChannel(channel: Channel): void {
        this.channels.add(channel);
        if (this.connection) {
            this.connection.channels.add(channel.getName());
        }
    }

    partChannel(channel: Channel): void {
        this.channels.delete(channel);
        if (this.connection) {
            this.connection.channels.delete(channel.getName());
        }
    }

    getChannels(): Channel[] {
        return Array.from(this.channels);
    }

    getChannelNames(): string[] {
        return Array.from(this.channels).map(ch => ch.getName());
    }

    isInChannel(channel: Channel): boolean {
        return this.channels.has(channel);
    }

    isInChannelByName(channelName: string): boolean {
        return Array.from(this.channels).some(ch => ch.getName() === channelName);
    }

    getChannelCount(): number {
        return this.channels.size;
    }

    // ===== Mode Management =====

    hasMode(mode: string): boolean {
        return this.modes.has(mode);
    }

    addMode(mode: string): void {
        this.modes.add(mode);
        if (this.connection) {
            this.connection.modes.add(mode);
        }
    }

    removeMode(mode: string): void {
        this.modes.delete(mode);
        if (this.connection) {
            this.connection.modes.delete(mode);
        }
    }

    getModes(): string {
        if (this.modes.size === 0) {
            return '';
        }
        return '+' + Array.from(this.modes).join('');
    }

    // ===== Away Status =====

    setAway(message: string): void {
        this.awayMessage = message;
        if (this.connection) {
            this.connection.awayMessage = message;
        }
    }

    clearAway(): void {
        this.awayMessage = undefined;
        if (this.connection) {
            this.connection.awayMessage = undefined;
        }
    }

    isAway(): boolean {
        return this.awayMessage !== undefined;
    }

    getAwayMessage(): string | undefined {
        return this.awayMessage;
    }

    // ===== Capability Management (IRCv3) =====

    hasCapability(cap: string): boolean {
        return this.capabilities.has(cap);
    }

    addCapability(cap: string): void {
        this.capabilities.add(cap);
        if (this.connection) {
            this.connection.capabilities.add(cap);
        }
    }

    removeCapability(cap: string): void {
        this.capabilities.delete(cap);
        if (this.connection) {
            this.connection.capabilities.delete(cap);
        }
    }

    getCapabilities(): Set<string> {
        return new Set(this.capabilities);
    }

    isTenantAware(): boolean {
        return this.capabilities.has('tenant-aware');
    }

    setTenantAware(aware: boolean): void {
        if (aware) {
            this.addCapability('tenant-aware');
        } else {
            this.removeCapability('tenant-aware');
        }

        if (this.connection) {
            this.connection.isTenantAware = aware;
        }
    }

    isCapNegotiating(): boolean {
        return this.connection?.capNegotiating || false;
    }

    setCapNegotiating(negotiating: boolean): void {
        if (this.connection) {
            this.connection.capNegotiating = negotiating;
        }
    }

    // ===== Communication =====

    sendMessage(message: string): void {
        if (!this.connection) {
            return;
        }

        let response = message;

        // Add server-time if capability enabled
        if (this.hasCapability('server-time')) {
            const timestamp = new Date().toISOString();
            response = `@time=${timestamp} ${response}`;
        }

        response += '\r\n';
        this.connection.socket.write(response);
    }

    sendReply(serverName: string, code: string, message: string): void {
        const nick = this.nickname || '*';
        let response = `:${serverName} ${code} ${nick} ${message}`;

        // Add server-time if capability enabled
        if (this.hasCapability('server-time')) {
            const timestamp = new Date().toISOString();
            response = `@time=${timestamp} ${response}`;
        }

        response += '\r\n';

        if (this.connection) {
            this.connection.socket.write(response);
        }
    }

    // ===== Tenant & API =====

    getTenant(): Tenant {
        return this.tenant;
    }

    getTenantName(): string {
        return this.tenant.getName();
    }

    authenticate(jwt: string, apiUrl: string, serverName: string): void {
        this.jwt = jwt;
        this.apiUrl = apiUrl;
        this.serverName = serverName;

        if (this.connection) {
            this.connection.jwt = jwt;
            this.connection.apiUrl = apiUrl;
            this.connection.serverName = serverName;
        }
    }

    isAuthenticated(): boolean {
        return this.jwt !== undefined;
    }

    getJwt(): string | undefined {
        return this.jwt;
    }

    getApiUrl(): string | undefined {
        return this.apiUrl;
    }

    getServerName(): string | undefined {
        return this.serverName;
    }

    // ===== Activity Tracking =====

    updateActivity(): void {
        this.lastActivity = new Date();
        if (this.connection) {
            this.connection.lastActivity = new Date();
        }
    }

    getLastActivity(): Date {
        return this.lastActivity;
    }

    getIdleSeconds(): number {
        const now = new Date();
        return Math.floor((now.getTime() - this.lastActivity.getTime()) / 1000);
    }

    getConnectedAt(): Date {
        return this.connection?.connectedAt || this.createdAt;
    }

    getConnectionDuration(): number {
        const connectedAt = this.getConnectedAt();
        const now = new Date();
        return Math.floor((now.getTime() - connectedAt.getTime()) / 1000);
    }

    // ===== Nickname History =====

    getNicknameHistory(): Array<{ nick: string; timestamp: Date }> {
        return [...this.nicknameHistory];
    }

    getPreviousNickname(): string | null {
        if (this.nicknameHistory.length < 2) {
            return null;
        }
        return this.nicknameHistory[this.nicknameHistory.length - 2].nick;
    }

    // ===== Shared Channels =====

    getSharedChannels(otherUser: User): Channel[] {
        return this.getChannels().filter(ch => otherUser.isInChannel(ch));
    }

    isSameTenant(otherUser: User): boolean {
        return this.tenant === otherUser.tenant;
    }

    // ===== Utility =====

    toString(): string {
        return `User{nick=${this.nickname}, user=${this.username}, tenant=${this.tenant.getName()}}`;
    }

    getStats(): {
        id: string;
        nickname: string;
        username: string;
        realname: string;
        tenant: string;
        connected: boolean;
        authenticated: boolean;
        channelCount: number;
        modes: string;
        away: boolean;
        idleSeconds: number;
        createdAt: Date;
    } {
        return {
            id: this.id,
            nickname: this.nickname,
            username: this.username,
            realname: this.realname,
            tenant: this.tenant.getName(),
            connected: this.isConnected(),
            authenticated: this.isAuthenticated(),
            channelCount: this.channels.size,
            modes: this.getModes(),
            away: this.isAway(),
            idleSeconds: this.getIdleSeconds(),
            createdAt: this.createdAt
        };
    }
}
