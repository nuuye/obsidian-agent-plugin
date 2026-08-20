import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteImproverPlugin from "./main";

export interface NoteImproverSettings {
    provider: "groq" | "ollama";
    groqApiKey: string;
    groqModel: string;
    ollamaModel: string;
}

export const DEFAULT_SETTINGS: NoteImproverSettings = {
    provider: "groq",
    groqApiKey: "",
    groqModel: "openai/gpt-oss-120b",
    ollamaModel: "",
};

export class NoteImproverSettingTab extends PluginSettingTab {
    plugin: NoteImproverPlugin;

    constructor(app: App, plugin: NoteImproverPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Provider")
            .addDropdown((dropdown) =>
                dropdown
                    .addOptions({ groq: "Groq (cloud)", ollama: "Ollama (local)" })
                    .setValue(this.plugin.settings.provider)
                    .onChange(async (value) => {
                        this.plugin.settings.provider = value as "groq" | "ollama";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Groq API key")
            .addText((text) =>
                text
                    .setPlaceholder("gsk_...")
                    .setValue(this.plugin.settings.groqApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.groqApiKey = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Groq model")
            .addText((text) =>
                text.setValue(this.plugin.settings.groqModel).onChange(async (value) => {
                    this.plugin.settings.groqModel = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Ollama model")
            .addText((text) =>
                text
                    .setPlaceholder("e.g. qwen3.5:9b-q6_K")
                    .setValue(this.plugin.settings.ollamaModel)
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaModel = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}