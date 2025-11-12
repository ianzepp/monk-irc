/**
 * HTTP client for monk-api data operations
 */

export class MonkApiClient {
    constructor(private baseUrl: string, private debug: boolean = false) {}

    async callDataEndpoint(schema: string, method: string, payload: any = {}, jwtToken?: string): Promise<any> {
        const url = `${this.baseUrl}/api/data/${schema}`;

        if (this.debug) {
            console.log(`🌐 API Call: ${method} ${url}`);
            if (method !== 'GET') {
                console.log(`🌐 Payload:`, JSON.stringify(payload, null, 2));
            }
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
        // For finding, we just GET all and filter in memory for simplicity
        const result = await this.callDataEndpoint('irc_users', 'GET', {}, jwtToken);
        if (result.data) {
            return result.data.filter((u: any) => u.nickname === nickname);
        }
        return [];
    }

    async createUser(user: any, jwtToken?: string): Promise<any> {
        // API expects an array of records for POST
        const result = await this.callDataEndpoint('irc_users', 'POST', [user], jwtToken);
        return result.data && result.data[0]; // Return first record
    }

    async updateUser(id: string, updates: any, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint(`irc_users/${id}`, 'PATCH', updates, jwtToken);
    }

    // Channel operations
    async findChannelByName(name: string, jwtToken?: string): Promise<any> {
        // For finding, we just GET all and filter in memory for simplicity
        const result = await this.callDataEndpoint('irc_channels', 'GET', {}, jwtToken);
        if (result.data) {
            return result.data.filter((c: any) => c.name === name);
        }
        return [];
    }

    async createChannel(channel: any, jwtToken?: string): Promise<any> {
        // API expects an array of records for POST
        const result = await this.callDataEndpoint('irc_channels', 'POST', [channel], jwtToken);
        return result.data && result.data[0]; // Return first record
    }

    async getOrCreateChannel(name: string, jwtToken?: string): Promise<any> {
        const existing = await this.findChannelByName(name, jwtToken);
        if (existing && existing.length > 0) {
            return existing[0];
        }

        const newChannel = {
            name,
            topic: '',
            modes: '+nt',
            created_at: new Date().toISOString()
        };

        const result = await this.createChannel(newChannel, jwtToken);
        return result; // Already returns first record
    }

    // Channel membership operations
    async getChannelMembers(channelId: string, jwtToken?: string): Promise<any> {
        // GET all and filter in memory
        const result = await this.callDataEndpoint('irc_channel_members', 'GET', {}, jwtToken);
        if (result.data) {
            return result.data.filter((m: any) => m.channel_id === channelId);
        }
        return [];
    }

    async joinChannel(channelId: string, userId: string, nickname: string, jwtToken?: string): Promise<any> {
        // API expects an array of records for POST
        const result = await this.callDataEndpoint('irc_channel_members', 'POST', [{
            channel_id: channelId,
            user_id: userId,
            nickname,
            modes: '',
            joined_at: new Date().toISOString()
        }], jwtToken);
        return result.data && result.data[0]; // Return first record
    }

    async leaveChannel(channelId: string, userId: string, jwtToken?: string): Promise<any> {
        // First find the membership record
        const members = await this.getChannelMembers(channelId, jwtToken);
        const membership = members.find((m: any) => m.user_id === userId);
        
        if (membership && membership.id) {
            // Delete by ID
            const result = await this.callDataEndpoint(`irc_channel_members/${membership.id}`, 'DELETE', {}, jwtToken);
            return result;
        }
        
        return null;
    }

    // Message operations
    async storeMessage(message: any, jwtToken?: string): Promise<any> {
        // API expects an array of records for POST
        const result = await this.callDataEndpoint('irc_messages', 'POST', [{
            ...message,
            sent_at: new Date().toISOString()
        }], jwtToken);
        return result.data && result.data[0]; // Return first record
    }

    async getRecentMessages(target: string, limit: number = 50, jwtToken?: string): Promise<any> {
        return this.callDataEndpoint('irc_messages', 'POST', {
            filter: { target },
            limit,
            sort: { sent_at: -1 }
        }, jwtToken);
    }
}
