import { AsyncLocalStorage, CustomEvent, tokenizers } from '../env/index.js';

const eventReasonAsyncLocalStorage = new AsyncLocalStorage();
function getEventCaller() {
    return eventReasonAsyncLocalStorage.getStore() ?? null;
}

class LlamaIndexCustomEvent extends CustomEvent {
    constructor(event, options){
        super(event, options);
        this.reason = null;
        this.reason = options?.reason ?? null;
    }
    static fromEvent(type, detail) {
        return new LlamaIndexCustomEvent(type, {
            detail: detail,
            reason: getEventCaller()
        });
    }
}
class CallbackManager {
    #handlers;
    on(event, handler) {
        if (!this.#handlers.has(event)) {
            this.#handlers.set(event, []);
        }
        this.#handlers.get(event).push(handler);
        return this;
    }
    off(event, handler) {
        if (!this.#handlers.has(event)) {
            return this;
        }
        const cbs = this.#handlers.get(event);
        const index = cbs.indexOf(handler);
        if (index > -1) {
            cbs.splice(index, 1);
        }
        return this;
    }
    dispatchEvent(event, detail) {
        const cbs = this.#handlers.get(event);
        if (!cbs) {
            return;
        }
        queueMicrotask(()=>{
            cbs.forEach((handler)=>handler(LlamaIndexCustomEvent.fromEvent(event, {
                    ...detail
                })));
        });
    }
    constructor(){
        this.#handlers = new Map();
    }
}
const globalCallbackManager = new CallbackManager();
const callbackManagerAsyncLocalStorage = new AsyncLocalStorage();
let currentCallbackManager = globalCallbackManager;
function getCallbackManager() {
    return callbackManagerAsyncLocalStorage.getStore() ?? currentCallbackManager;
}
function setCallbackManager(callbackManager) {
    currentCallbackManager = callbackManager;
}
function withCallbackManager(callbackManager, fn) {
    return callbackManagerAsyncLocalStorage.run(callbackManager, fn);
}

const chunkSizeAsyncLocalStorage$1 = new AsyncLocalStorage();
let globalChunkSize = 1024;
function getChunkSize() {
    return globalChunkSize ?? chunkSizeAsyncLocalStorage$1.getStore();
}
function setChunkSize(chunkSize) {
    if (chunkSize !== undefined) {
        globalChunkSize = chunkSize;
    }
}
function withChunkSize(embeddedModel, fn) {
    return chunkSizeAsyncLocalStorage$1.run(embeddedModel, fn);
}

const chunkSizeAsyncLocalStorage = new AsyncLocalStorage();
let globalTokenizer = tokenizers.tokenizer();
function getTokenizer() {
    return globalTokenizer ?? chunkSizeAsyncLocalStorage.getStore();
}
function setTokenizer(tokenizer) {
    if (tokenizer !== undefined) {
        globalTokenizer = tokenizer;
    }
}
function withTokenizer(tokenizer, fn) {
    return chunkSizeAsyncLocalStorage.run(tokenizer, fn);
}

const Settings = {
    get tokenizer () {
        return getTokenizer();
    },
    set tokenizer (tokenizer){
        setTokenizer(tokenizer);
    },
    withTokenizer (tokenizer1, fn) {
        return withTokenizer(tokenizer1, fn);
    },
    get chunkSize () {
        return getChunkSize();
    },
    set chunkSize (chunkSize){
        setChunkSize(chunkSize);
    },
    withChunkSize (chunkSize1, fn) {
        return withChunkSize(chunkSize1, fn);
    },
    get callbackManager () {
        return getCallbackManager();
    },
    set callbackManager (callbackManager){
        setCallbackManager(callbackManager);
    },
    withCallbackManager (callbackManager1, fn) {
        return withCallbackManager(callbackManager1, fn);
    }
};

export { CallbackManager, Settings };
