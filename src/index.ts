/**
 * monk-irc - IRC Protocol Server for monk-api Integration
 *
 * Main entry point that sets up the IRC server with command dispatch
 * to individual command handlers.
 */

import { IrcServer } from './lib/irc-server.js';
import type { ServerConfig } from './lib/types.js';

async function createServer(): Promise<IrcServer> {
    const config: ServerConfig = {
        port: parseInt(process.env.IRC_PORT || '6667'),
        host: process.env.IRC_HOST || 'localhost',
        serverName: process.env.IRC_SERVER_NAME || 'irc.monk.local',
        apiUrl: process.env.MONK_API_URL || 'http://localhost:9001',
        apiToken: process.env.MONK_JWT_TOKEN || '',
        debug: process.env.NODE_ENV === 'development'
    };

    if (!config.apiToken) {
        throw new Error('MONK_JWT_TOKEN environment variable is required');
    }

    return new IrcServer(config);
}

export async function main(): Promise<void> {
    console.log('🚀 monk-irc server starting...');

    try {
        const server = await createServer();
        await server.start();

        console.log('✅ monk-irc server ready');

        // Graceful shutdown handling
        process.on('SIGINT', async () => {
            console.log('\n📡 Received SIGINT, shutting down gracefully...');
            await server.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n📡 Received SIGTERM, shutting down gracefully...');
            await server.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start monk-irc server:', error);
        process.exit(1);
    }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ monk-irc startup error:', error);
        process.exit(1);
    });
}
