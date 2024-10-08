import { Document } from "../schema/index.js";
import { getEnv } from "../env/index.js";
/**
 * Represents a reader for Discord messages using @discordjs/rest
 * See https://github.com/discordjs/discord.js/tree/main/packages/rest
 */ export class DiscordReader {
    client;
    constructor(discordToken, requestHandler){
        const token = discordToken ?? getEnv("DISCORD_TOKEN");
        if (!token) {
            throw new Error("Must specify `discordToken` or set environment variable `DISCORD_TOKEN`.");
        }
        const restOptions = {
            version: "10"
        };
        // Use the provided request handler if specified
        if (requestHandler) {
            restOptions.makeRequest = requestHandler;
        }
        this.restOptions = restOptions;
        this.token = token;
    }
    async getClient() {
        const { REST } = await import("@discordjs/rest");
        return new REST(this.restOptions).setToken(this.token);
    }
    // Read all messages in a channel given a channel ID
    async readChannel(channelId, limit, additionalInfo, oldestFirst) {
        const { Routes } = await import("discord-api-types/v10");
        const client = await this.getClient();
        const params = new URLSearchParams();
        if (limit) params.append("limit", limit.toString());
        if (oldestFirst) params.append("after", "0");
        try {
            const endpoint = `${Routes.channelMessages(channelId)}?${params}`;
            const messages = await client.get(endpoint);
            return messages.map((msg)=>this.createDocumentFromMessage(msg, additionalInfo));
        } catch (err) {
            console.error(err);
            return [];
        }
    }
    createDocumentFromMessage(msg, additionalInfo) {
        let content = msg.content || "";
        // Include information from embedded messages
        if (additionalInfo && msg.embeds.length > 0) {
            content += "\n" + msg.embeds.map((embed)=>this.embedToString(embed)).join("\n");
        }
        // Include URL from attachments
        if (additionalInfo && msg.attachments.length > 0) {
            content += "\n" + msg.attachments.map((attachment)=>`Attachment: ${attachment.url}`).join("\n");
        }
        return new Document({
            text: content,
            id_: msg.id,
            metadata: {
                messageId: msg.id,
                username: msg.author.username,
                createdAt: new Date(msg.timestamp).toISOString(),
                editedAt: msg.edited_timestamp ? new Date(msg.edited_timestamp).toISOString() : undefined
            }
        });
    }
    // Create a string representation of an embedded message
    embedToString(embed) {
        let result = "***Embedded Message***\n";
        if (embed.title) result += `**${embed.title}**\n`;
        if (embed.description) result += `${embed.description}\n`;
        if (embed.url) result += `${embed.url}\n`;
        if (embed.fields) {
            result += embed.fields.map((field)=>`**${field.name}**: ${field.value}`).join("\n");
        }
        return result.trim();
    }
    /**
   * Loads messages from multiple discord channels and returns an array of Document Objects.
   *
   * @param {string[]} channelIds - An array of channel IDs from which to load data.
   * @param {number} [limit] - An optional limit on the number of messages to load per channel.
   * @param {boolean} [additionalInfo] - An optional flag to include content from embedded messages and attachments urls as text.
   * @param {boolean} [oldestFirst] - An optional flag to load oldest messages first.
   * @return {Promise<Document[]>} A promise that resolves to an array of loaded documents.
   */ async loadData(channelIds, limit, additionalInfo, oldestFirst) {
        let results = [];
        for (const channelId of channelIds){
            if (typeof channelId !== "string") {
                throw new Error(`Channel id ${channelId} must be a string.`);
            }
            const channelDocuments = await this.readChannel(channelId, limit, additionalInfo, oldestFirst);
            results = results.concat(channelDocuments);
        }
        return results;
    }
}
