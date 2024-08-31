import { getEnv } from '../env/index.js';
import { Settings } from '../global/index.js';

function chunkSizeCheck(contentGetter, _context) {
    return function(...args) {
        const content = contentGetter.call(this, ...args);
        const chunkSize = Settings.chunkSize;
        const enableChunkSizeCheck = getEnv("ENABLE_CHUNK_SIZE_CHECK") === "true";
        if (enableChunkSizeCheck && chunkSize !== undefined && content.length > chunkSize) {
            console.warn(`Node (${this.id_}) is larger than chunk size: ${content.length} > ${chunkSize}`);
            {
                console.warn("Will truncate the content if it is larger than chunk size");
                console.warn("If you want to disable this behavior:");
                console.warn("  1. Set Settings.chunkSize = undefined");
                console.warn("  2. Set Settings.chunkSize to a larger value");
                console.warn("  3. Change the way of splitting content into smaller chunks");
            }
            return content.slice(0, chunkSize);
        }
        return content;
    };
}
function lazyInitHash(value, _context) {
    return {
        get () {
            const oldValue = value.get.call(this);
            if (oldValue === "") {
                const hash = this.generateHash();
                value.set.call(this, hash);
            }
            return value.get.call(this);
        },
        set (newValue) {
            value.set.call(this, newValue);
        },
        init (value) {
            return value;
        }
    };
}

export { chunkSizeCheck, lazyInitHash };
