/**
 * HTTP client for monk-api data operations
 */

export class MonkApiClient {
    constructor(private baseUrl: string, private debug: boolean = false) {}

    async callDataEndpoint(schema: string, method: string, payload: any = {}, jwtToken?: string): Promise<any> {
        const url = `${this.baseUrl}/data/${schema}`;

        if (this.debug) {
            console.log(`🌐 API Call: ${method} ${url}`);
            console.log(`🌐 Payload:`, JSON.stringify(payload, null, 2));
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`;
        }

        const response = await fetch(url, {
            method,
            headers,
            body: method !== 'GET' ? JSON.stringify(payload) : undefined
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        if (this.debug) {
            console.log(`🌐 Response:`, JSON.stringify(result, null, 2));
        }

        return result;
    }

    // User operations
    async findUserByNickname(nickname: string, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_users', 'POST', {
            filter: { nickname }
        }, jwtToken);
    }

    async createUser(user: any, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_users', 'POST', user, jwtToken);
    }

    async updateUser(id: string, updates: any, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint(`irc_users/${id}`, 'PATCH', updates, jwtToken);
    }

    // Channel operations
    async findChannelByName(name: string, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_channels', 'POST', {
            filter: { name }
        }, jwtToken);
    }

    async createChannel(channel: any, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_channels', 'POST', channel, jwtToken);
    }

    async getOrCreateChannel(name: string, jwtToken?: string): Promise<any> {
        const existing = await this.findChannelByName(name, jwtToken);
        if (existing && existing.data && existing.data.length > 0) {
            return existing.data[0];
        }

        const newChannel = {
            name,
            topic: '',
            modes: '+nt',
            created_at: new Date().toISOString()
        };

        const result = await this.createChannel(newChannel, jwtToken);
        return result.data;
    }

    // Channel membership operations
    async getChannelMembers(channelId: string, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_channel_members', 'POST', {
            filter: { channel_id: channelId }
        }, jwtToken);
    }

    async joinChannel(channelId: string, userId: string, nickname: string, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_channel_members', 'POST', {
            channel_id: channelId,
            user_id: userId,
            nickname,
            modes: '',
            joined_at: new Date().toISOString()
        }, jwtToken);
    }

    async leaveChannel(channelId: string, userId: string, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_channel_members', 'DELETE', {
            filter: { channel_id: channelId, user_id: userId }
        }, jwtToken);
    }

    // Message operations
    async storeMessage(message: any, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_messages', 'POST', {
            ...message,
            sent_at: new Date().toISOString()
        }, jwtToken);
    }

    async getRecentMessages(target: string, limit: number = 50, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_messages', 'POST', {
            filter: { target },
            limit,
            sort: { sent_at: -1 }
        }, jwtToken);
    }
}
