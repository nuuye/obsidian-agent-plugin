export interface GenerateOptions {
    skipThinking?: boolean;
    onToken?: (chunk: string) => void;
}

export interface LLMProvider {
    generate(prompt: string, options?: GenerateOptions): Promise<string>;
}
