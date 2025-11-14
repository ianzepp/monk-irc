/**
 * Channel class - Encapsulates IRC channel state and behavior
 */

import type { Tenant } from './tenant.js';
import type { User } from './user.js';

export enum ChannelMode {
    OPERATOR = '@',
    VOICE = '+',
    HALFOP = '%'
}

export interface ChannelTopicInfo {
    topic?: string;
    setBy?: string;
    setAt?: Date;
}

export interface SchemaMetadata {
    totalRecords: number;
    oldestCreated?: Date;
    newestCreated?: Date;
    lastUpdated?: Date;
    statusBreakdown?: Record<string, number>;
    fetchedAt: Date;
}

export class Channel {
    private readonly name: string;
    private readonly tenant: Tenant;
    private members = new Map<User, Set<ChannelMode>>();
    private topic?: string;
    private topicSetBy?: string;
    private topicSetAt?: Date;
    private modes = new Set<string>(); // +n, +t, +i, +m, +s, +p
    private readonly createdAt: Date;
    private readonly createdBy: string;
    private key?: string; // Channel password (+k mode)
    private schemaMetadata?: SchemaMetadata; // Aggregate data from monk-api

    constructor(name: string, tenant: Tenant, createdBy: string) {
        this.name = name;
        this.tenant = tenant;
        this.createdBy = createdBy;
        this.createdAt = new Date();

        // Default modes: +nt (no external messages, topic protection)
        this.modes.add('n');
        this.modes.add('t');
    }

    // ===== Membership Management =====

    addMember(user: User, roles?: Set<ChannelMode>): void {
        this.members.set(user, roles || new Set());
    }

    removeMember(user: User): void {
        this.members.delete(user);
    }

    getMembers(): User[] {
        return Array.from(this.members.keys());
    }

    getMemberCount(): number {
        return this.members.size;
    }

    hasMember(user: User): boolean {
        return this.members.has(user);
    }

    getMemberRoles(user: User): Set<ChannelMode> {
        return this.members.get(user) || new Set();
    }

    setMemberRoles(user: User, roles: Set<ChannelMode>): void {
        if (this.members.has(user)) {
            this.members.set(user, roles);
        }
    }

    addMemberRole(user: User, role: ChannelMode): void {
        const roles = this.getMemberRoles(user);
        roles.add(role);
        this.setMemberRoles(user, roles);
    }

    removeMemberRole(user: User, role: ChannelMode): void {
        const roles = this.getMemberRoles(user);
        roles.delete(role);
        this.setMemberRoles(user, roles);
    }

    isOperator(user: User): boolean {
        return this.getMemberRoles(user).has(ChannelMode.OPERATOR);
    }

    hasVoice(user: User): boolean {
        return this.getMemberRoles(user).has(ChannelMode.VOICE);
    }

    // ===== Broadcasting =====

    broadcast(message: string, excludeUser?: User): void {
        for (const member of this.members.keys()) {
            if (excludeUser && member === excludeUser) {
                continue;
            }
            member.sendMessage(message);
        }
    }

    broadcastFromUser(sender: User, message: string, excludeSender: boolean = true): void {
        const prefix = sender.getUserPrefix();
        const fullMessage = `:${prefix} ${message}`;
        this.broadcast(fullMessage, excludeSender ? sender : undefined);
    }

    // ===== Topic Management =====

    getTopic(): string | undefined {
        return this.topic;
    }

    setTopic(topic: string, setBy: string): void {
        this.topic = topic;
        this.topicSetBy = setBy;
        this.topicSetAt = new Date();
    }

    clearTopic(): void {
        this.topic = undefined;
        this.topicSetBy = undefined;
        this.topicSetAt = undefined;
    }

    getTopicInfo(): ChannelTopicInfo {
        return {
            topic: this.topic,
            setBy: this.topicSetBy,
            setAt: this.topicSetAt
        };
    }

    // ===== Mode Management =====

    hasMode(mode: string): boolean {
        return this.modes.has(mode);
    }

    addMode(mode: string): void {
        this.modes.add(mode);
    }

    removeMode(mode: string): void {
        this.modes.delete(mode);
    }

    getModes(): string {
        if (this.modes.size === 0) {
            return '';
        }
        return '+' + Array.from(this.modes).join('');
    }

    setKey(key: string): void {
        this.key = key;
        this.addMode('k');
    }

    removeKey(): void {
        this.key = undefined;
        this.removeMode('k');
    }

    getKey(): string | undefined {
        return this.key;
    }

    checkKey(key: string): boolean {
        if (!this.hasMode('k')) {
            return true; // No key required
        }
        return this.key === key;
    }

    // ===== Permission Checks =====

    canSendMessage(user: User): boolean {
        // +m (moderated) - only ops and voiced can speak
        if (this.hasMode('m')) {
            return this.isOperator(user) || this.hasVoice(user);
        }

        // +n (no external messages) - must be member
        if (this.hasMode('n')) {
            return this.hasMember(user);
        }

        return true;
    }

    canSetTopic(user: User): boolean {
        // +t (topic protection) - only ops can set topic
        if (this.hasMode('t')) {
            return this.isOperator(user);
        }

        // Without +t, any member can set topic
        return this.hasMember(user);
    }

    canKick(user: User): boolean {
        // Only operators can kick
        return this.isOperator(user);
    }

    canInvite(user: User): boolean {
        // +i (invite only) - only ops can invite
        if (this.hasMode('i')) {
            return this.isOperator(user);
        }

        // Without +i, any member can invite
        return this.hasMember(user);
    }

    canJoin(user: User, key?: string): boolean {
        // +i (invite only) - would need invite list (not implemented)
        if (this.hasMode('i')) {
            return false; // For now, invite-only channels can't be joined
        }

        // +k (key required) - check password
        if (this.hasMode('k')) {
            return this.checkKey(key || '');
        }

        return true;
    }

    // ===== Schema Integration (monk-api) =====

    getSchemaName(): string | null {
        if (!this.name.startsWith('#')) {
            return null;
        }

        const withoutHash = this.name.substring(1);
        const slashIndex = withoutHash.indexOf('/');

        if (slashIndex > -1) {
            return withoutHash.substring(0, slashIndex);
        }

        return withoutHash;
    }

    getRecordId(): string | null {
        if (!this.name.startsWith('#')) {
            return null;
        }

        const withoutHash = this.name.substring(1);
        const slashIndex = withoutHash.indexOf('/');

        if (slashIndex > -1) {
            return withoutHash.substring(slashIndex + 1);
        }

        return null;
    }

    isRecordChannel(): boolean {
        return this.getRecordId() !== null;
    }

    // ===== Metadata =====

    getName(): string {
        return this.name;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getCreatedBy(): string {
        return this.createdBy;
    }

    getTenant(): Tenant {
        return this.tenant;
    }

    isEmpty(): boolean {
        return this.members.size === 0;
    }

    setSchemaMetadata(metadata: SchemaMetadata): void {
        this.schemaMetadata = metadata;
    }

    getSchemaMetadata(): SchemaMetadata | undefined {
        return this.schemaMetadata;
    }

    // ===== Utility =====

    getMemberListWithRoles(): string {
        const memberStrings: string[] = [];

        for (const [user, roles] of this.members.entries()) {
            let prefix = '';

            // Show highest privilege: @ > % > +
            if (roles.has(ChannelMode.OPERATOR)) {
                prefix = '@';
            } else if (roles.has(ChannelMode.HALFOP)) {
                prefix = '%';
            } else if (roles.has(ChannelMode.VOICE)) {
                prefix = '+';
            }

            memberStrings.push(prefix + user.getNickname());
        }

        return memberStrings.join(' ');
    }

    getStats(): {
        name: string;
        memberCount: number;
        topic?: string;
        modes: string;
        createdAt: Date;
        createdBy: string;
    } {
        return {
            name: this.name,
            memberCount: this.members.size,
            topic: this.topic,
            modes: this.getModes(),
            createdAt: this.createdAt,
            createdBy: this.createdBy
        };
    }
}
