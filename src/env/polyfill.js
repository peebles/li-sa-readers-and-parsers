/**
 * Polyfill implementation for `../env/index.js`.
 *
 * The code should be compatible with any JS runtime.
 *
 * Sometimes you should overwrite the polyfill with a native implementation.
 *
 * @module
 */ import { Sha256 } from "@aws-crypto/sha256-js";
import pathe from "pathe";
import { fs } from "./fs/memory.js";
export { fs, pathe as path };
export const EOL = "\n";
export function ok(value, message) {
    if (!value) {
        const error = Error(message);
        error.name = "AssertionError";
        error.message = message ?? "The expression evaluated to a falsy value.";
        throw error;
    }
}
export function createSHA256() {
    const sha256 = new Sha256();
    return {
        update (data) {
            sha256.update(data);
        },
        digest () {
            return globalThis.btoa(sha256.digestSync().toString());
        }
    };
}
export function randomUUID() {
    return crypto.randomUUID();
}
// @ts-expect-error
const ReadableStream = globalThis.ReadableStream;
// @ts-expect-error
const TransformStream = globalThis.TransformStream;
// @ts-expect-error
const WritableStream = globalThis.WritableStream;
export { AsyncLocalStorage, CustomEvent, getEnv, setEnvs } from "./utils.js";
export { ReadableStream, TransformStream, WritableStream };
