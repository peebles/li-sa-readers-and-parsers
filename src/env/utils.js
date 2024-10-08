// DO NOT EXPOSE THIS VARIABLE TO PUBLIC, IT IS USED INTERNALLY FOR CLOUDFLARE WORKER
export const INTERNAL_ENV = {};
/**
 * Set environment variables before using llamaindex, because some LLM need to access API key before running.
 *
 * You have to set the environment variables in Cloudflare Worker environment,
 * because it doesn't have any global environment variables.
 *
 * @example
 * ```ts
 * export default {
 *   async fetch(
 *     request: Request,
 *     env: Env,
 *     ctx: ExecutionContext,
 *   ): Promise<Response> {
 *     const { setEnvs } = await import("../env/index.js");
 *     setEnvs(env);
 *     // ...
 *     return new Response("Hello, World!");
 *   },
 * };
 * ```
 *
 * @param envs Environment variables
 */ export function setEnvs(envs) {
    Object.assign(INTERNAL_ENV, envs);
}
export function getEnv(name) {
    if (INTERNAL_ENV[name]) {
        return INTERNAL_ENV[name];
    }
    if (typeof process === "undefined" || typeof process.env === "undefined") {
        // @ts-expect-error
        if (typeof Deno === "undefined") {
            throw new Error("Current environment is not supported");
        } else {
            // @ts-expect-error
            return Deno.env.get(name);
        }
    }
    return process.env[name];
}
// Async Local Storage is available cross different JS runtimes
export { AsyncLocalStorage } from "node:async_hooks";
// Node.js 18 doesn't have CustomEvent by default
// Refs: https://github.com/nodejs/node/issues/40678
class CustomEvent extends Event {
    #detail;
    get detail() {
        return this.#detail;
    }
    constructor(event, options){
        super(event, options);
        this.#detail = options?.detail;
    }
    /**
   * @deprecated This method is not supported
   */ initCustomEvent() {
        throw new Error("initCustomEvent is not supported");
    }
}
const defaultCustomEvent = globalThis.CustomEvent || CustomEvent;
export { defaultCustomEvent as CustomEvent };
