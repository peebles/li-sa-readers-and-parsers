import { AsyncLocalStorage, randomUUID } from '../env/index.js';
import { Settings } from '../global/index.js';

const isAsyncIterable = (obj)=>{
    return obj != null && typeof obj === "object" && Symbol.asyncIterator in obj;
};
const isIterable = (obj)=>{
    return obj != null && typeof obj === "object" && Symbol.iterator in obj;
};
const eventReasonAsyncLocalStorage = new AsyncLocalStorage();
/**
 * EventCaller is used to track the caller of an event.
 */ class EventCaller {
    constructor(caller, parent){
        this.caller = caller;
        this.parent = parent;
        this.id = randomUUID();
        this.#computedCallers = null;
    }
    #computedCallers;
    get computedCallers() {
        if (this.#computedCallers != null) {
            return this.#computedCallers;
        }
        const callers = [
            this.caller
        ];
        let parent = this.parent;
        while(parent != null){
            callers.push(parent.caller);
            parent = parent.parent;
        }
        this.#computedCallers = callers;
        return callers;
    }
    static create(caller, parent) {
        return new EventCaller(caller, parent);
    }
}
function getEventCaller() {
    return eventReasonAsyncLocalStorage.getStore() ?? null;
}
/**
 * @param caller who is calling this function, pass in `this` if it's a class method
 * @param fn
 */ function withEventCaller(caller, fn) {
    // create a chain of event callers
    const parentCaller = getEventCaller();
    return eventReasonAsyncLocalStorage.run(EventCaller.create(caller, parentCaller), fn);
}
function wrapEventCaller(originalMethod, context) {
    const name = context.name;
    context.addInitializer(function() {
        // @ts-expect-error
        const fn = this[name].bind(this);
        // @ts-expect-error
        this[name] = (...args)=>{
            return withEventCaller(this, ()=>fn(...args));
        };
    });
    return function(...args) {
        const result = originalMethod.call(this, ...args);
        // patch for iterators because AsyncLocalStorage doesn't work with them
        if (isAsyncIterable(result)) {
            const iter = result[Symbol.asyncIterator]();
            const snapshot = AsyncLocalStorage.snapshot();
            return async function* asyncGeneratorWrapper() {
                while(true){
                    const { value, done } = await snapshot(()=>iter.next());
                    if (done) {
                        break;
                    }
                    yield value;
                }
            }();
        } else if (isIterable(result)) {
            const iter = result[Symbol.iterator]();
            const snapshot = AsyncLocalStorage.snapshot();
            return function* generatorWrapper() {
                while(true){
                    const { value, done } = snapshot(()=>iter.next());
                    if (done) {
                        break;
                    }
                    yield value;
                }
            }();
        }
        return result;
    };
}

function wrapLLMEvent(originalMethod, _context) {
    return async function withLLMEvent(...params) {
        const id = randomUUID();
        Settings.callbackManager.dispatchEvent("llm-start", {
            id,
            messages: params[0].messages
        });
        const response = await originalMethod.call(this, ...params);
        if (Symbol.asyncIterator in response) {
            // save snapshot to restore it after the response is done
            const snapshot = AsyncLocalStorage.snapshot();
            const originalAsyncIterator = {
                [Symbol.asyncIterator]: response[Symbol.asyncIterator].bind(response)
            };
            response[Symbol.asyncIterator] = async function*() {
                const finalResponse = {
                    raw: [],
                    message: {
                        content: "",
                        role: "assistant",
                        options: {}
                    }
                };
                let firstOne = false;
                for await (const chunk of originalAsyncIterator){
                    if (!firstOne) {
                        firstOne = true;
                        finalResponse.message.content = chunk.delta;
                    } else {
                        finalResponse.message.content += chunk.delta;
                    }
                    if (chunk.options) {
                        finalResponse.message.options = {
                            ...finalResponse.message.options,
                            ...chunk.options
                        };
                    }
                    Settings.callbackManager.dispatchEvent("llm-stream", {
                        id,
                        chunk
                    });
                    finalResponse.raw.push(chunk);
                    yield chunk;
                }
                snapshot(()=>{
                    Settings.callbackManager.dispatchEvent("llm-end", {
                        id,
                        response: finalResponse
                    });
                });
            };
        } else {
            Settings.callbackManager.dispatchEvent("llm-end", {
                id,
                response
            });
        }
        return response;
    };
}

/**
 * Extracts just the text whether from
 *  a multi-modal message
 *  a single text message
 *  or a query
 *
 * @param message The message to extract text from.
 * @returns The extracted text
 */ function extractText(message) {
    if (typeof message === "object" && "query" in message) {
        return extractText(message.query);
    }
    if (typeof message !== "string" && !Array.isArray(message)) {
        console.warn("extractText called with non-MessageContent message, this is likely a bug.");
        return `${message}`;
    } else if (typeof message !== "string" && Array.isArray(message)) {
        // message is of type MessageContentDetail[] - retrieve just the text parts and concatenate them
        // so we can pass them to the context generator
        return message.filter((c)=>c.type === "text").map((c)=>c.text).join("\n\n");
    } else {
        return message;
    }
}
/**
 * Extracts a single text from a multi-modal message content
 *
 * @param message The message to extract images from.
 * @returns The extracted images
 */ function extractSingleText(message) {
    if (message.type === "text") {
        return message.text;
    }
    return null;
}
/**
 * Extracts an image from a multi-modal message content
 *
 * @param message The message to extract images from.
 * @returns The extracted images
 */ function extractImage(message) {
    if (message.type === "image_url") {
        return new URL(message.image_url.url);
    }
    return null;
}
const extractDataUrlComponents = (dataUrl)=>{
    const parts = dataUrl.split(";base64,");
    if (parts.length !== 2 || !parts[0].startsWith("data:")) {
        throw new Error("Invalid data URL");
    }
    const mimeType = parts[0].slice(5);
    const base64 = parts[1];
    return {
        mimeType,
        base64
    };
};

async function* streamConverter(stream, converter) {
    for await (const data of stream){
        const newData = converter(data);
        if (newData === null) {
            return;
        }
        yield newData;
    }
}
async function* streamCallbacks(stream, callbacks) {
    let value;
    for await (value of stream){
        yield value;
    }
    if (callbacks.finished) {
        callbacks.finished(value);
    }
}
async function* streamReducer(params) {
    let value = params.initialValue;
    for await (const data of params.stream){
        value = params.reducer(value, data);
        yield data;
    }
    if (params.finished) {
        params.finished(value);
    }
}

export { extractDataUrlComponents, extractImage, extractSingleText, extractText, streamCallbacks, streamConverter, streamReducer, wrapEventCaller, wrapLLMEvent };
