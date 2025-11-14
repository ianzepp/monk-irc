/**
 * Registry for in-channel functions
 */

import type { BaseFunction } from './base-function.js';

export class FunctionRegistry {
    private functions = new Map<string, BaseFunction>();

    /**
     * Register a function
     */
    register(func: BaseFunction): void {
        this.functions.set(func.name.toLowerCase(), func);
    }

    /**
     * Get a function by name (case-insensitive)
     */
    get(name: string): BaseFunction | undefined {
        return this.functions.get(name.toLowerCase());
    }

    /**
     * Get all registered functions
     */
    getAll(): BaseFunction[] {
        return Array.from(this.functions.values());
    }

    /**
     * Check if a function exists
     */
    has(name: string): boolean {
        return this.functions.has(name.toLowerCase());
    }

    /**
     * Get function names
     */
    getNames(): string[] {
        return Array.from(this.functions.keys());
    }
}
