import TelegramBot from "node-telegram-bot-api";
import { ChatSettingTemplate } from "../../src/chat/settings/chat-setting-template";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { BotCommand } from "../../src/bot-commands/bot-command";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";
import { URL } from "url";
import * as http from "http";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require("os");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

export class Plugin extends AbstractPlugin {
    constructor() {
        super("tts", "1.0.0");
    }

    /**
     * @override
     */
    public getPluginSpecificCommands(): BotCommand[] {
        const command = new BotCommand(["tts", "🤖"], "Have DTB say something", this.tts.bind(this));
        return [command];
    }

    /**
     * @override
     */
    public getPluginSpecificChatSettings(): Array<ChatSettingTemplate<any>> {
        return [
            new ChatSettingTemplate("tts.coqui.location", "🐸 Coqui location", "", (original: any) => original + "", (_: any) => null),
        ];
    }

    private tts(chat: Chat, user: User, msg: TelegramBot.Message, match: string) {
        if (!/^\/tts/.test(msg.text ?? "")) {
            return;
        }

        let messageToParse = msg.text ?? "";
        const hasOption = messageToParse.match(/(-\w .+?\b)/gms);
        let voice = "jenny";

        if (hasOption) {
            for (const option of hasOption) {
                console.log("option", option);
                if (/^-v/.test(option)) {
                    voice = option.replace("-v", "").trim();
                    console.log("Using voice", voice);
                }

                if (/^-x/.test(option)) {
                    console.log("Dummy setting", option);
                }

                messageToParse = messageToParse.replace(option, "");
            }
        }

        if (msg.reply_to_message) {
            messageToParse = msg.reply_to_message.text ?? "";
        } else {
            messageToParse = messageToParse.replace("/tts", "").trim().replace(/\s{2,}/gms, " ");
        }

        console.log("message to speak: ", messageToParse);

        const ttsText = messageToParse.substring(0, 1024);
        const location: string = chat.getSetting("tts.coqui.location") || "";
        const cUrl = new URL(`${location.replace(/\/*$/, "")}/api/tts`);
        cUrl.searchParams.set("text", ttsText);
        cUrl.searchParams.set("speaker_id", "");
        cUrl.searchParams.set("style_wav", "");

        http.get(cUrl.toString(), resp => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtb-tts"));
            resp.setEncoding("binary");
            let data: any = [];

            resp.on("data", chunk => {
                data.push(Buffer.from(chunk, "binary"));
            });

            resp.on("end", () => {
                data = Buffer.concat(data);
                if (resp.complete) {
                    const filePath = path.join(tmpDir, "output.wav");
                    fs.writeFileSync(filePath, data, "binary");
                    this.sendFile(chat.id, filePath, -1, false, "", "audio").then(() => {
                        try {
                            fs.rmSync(filePath);
                        } catch (e) {
                            console.error(e);
                        }
                    });
                }
            });
        });
    }
}