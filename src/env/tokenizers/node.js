// Note: This is using th WASM implementation of tiktoken which is 60x faster
import { Tokenizers } from "./types.js";
import { get_encoding } from "tiktoken";
class TokenizerSingleton {
    defaultTokenizer;
    constructor(){
        const encoding = get_encoding("cl100k_base");
        this.defaultTokenizer = {
            encode: (text)=>{
                return encoding.encode(text);
            },
            decode: (tokens)=>{
                const text = encoding.decode(tokens);
                return new TextDecoder().decode(text);
            }
        };
    }
    tokenizer(encoding) {
        if (encoding && encoding !== Tokenizers.CL100K_BASE) {
            throw new Error(`Tokenizer encoding ${encoding} not yet supported`);
        }
        return this.defaultTokenizer;
    }
}
export const tokenizers = new TokenizerSingleton();
export { Tokenizers };
