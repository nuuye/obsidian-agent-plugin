# Note Improver

Note Improver is an Obsidian plugin that analyzes the active Markdown note with an LLM, proposes a clearer and better-structured version, and lets you review and approve the changes before modifying the note.

The plugin supports **Groq** (cloud) and **Ollama** (local).

## Features

- Corrects spelling, wording, and Markdown formatting.
- Adapts improvements to the type of note: memo, concept note, or reference note.
- Clarifies uncertain passages and fills in essential missing information.
- Preserves the note’s primary heading and dominant writing style.
- Adds YAML aliases based on detected topics when the note does not already have frontmatter.
- Turns the first occurrence of known concepts into Obsidian internal links (`[[Note name]]`).
- Can generate a Mermaid diagram when it provides meaningful value.
- Displays every proposed change with a **Before / After** preview.
- Lets you accept all changes, accept only a selection, or reject everything.
- Creates a backup of the original note before applying changes.

## Requirements

- Obsidian 1.4.0 or later.
- A [Groq API key](https://console.groq.com/keys), or a local [Ollama](https://ollama.com/) installation.
- Obsidian on desktop: the plugin is currently declared as desktop-only.

## Manual installation

To install Note Improver without using the community plugin catalog:

1. Download `main.js`, `manifest.json`, and `styles.css` from the desired release.
2. Create the following folder in your vault:

   ```text
   <YourVault>/.obsidian/plugins/obsidian-note-improver/
   ```

3. Copy the three files into that folder.
4. Reload Obsidian.
5. Open **Settings → Community plugins**, then enable **Note Improver**.

## Configuration

Open **Settings → Note Improver**, then choose a provider.

### Groq

1. Select **Groq (cloud)**.
2. Enter your **Groq API key**.
3. Enter the model to use. The default is `openai/gpt-oss-120b`.

The API key is stored by Obsidian in the plugin’s local data. Do not share your vault’s configuration files.

### Ollama

1. Install and start Ollama on your computer.
2. Download a model, for example:

   ```bash
   ollama pull qwen3.5:9b-q6_K
   ```

3. Select **Ollama (local)** in the plugin settings.
4. Enter the exact model name under **Ollama model**.

The plugin connects to Ollama at `http://127.0.0.1:11434`.

## Usage

1. Open a Markdown note.
2. Select the magic wand icon in the ribbon, or run **Improve note with AI** from the command palette.
3. Wait for the analysis to finish.
4. Expand **Show change** to compare each proposal.
5. Enable or disable the changes you want.
6. Select:

   - **Accept all** to apply every change;
   - **Accept selection** to apply only the enabled changes;
   - **Reject all** to close the window without modifying the note.

When changes are applied, the original version is saved in the `backups/` folder at the root of the vault. Backups are timestamped and are not deleted automatically.

## Privacy

Behavior depends on the selected provider:

- **Groq**: the complete contents of the active note are sent to the Groq API for analysis and rewriting. Review Groq’s terms and privacy policy before using it.
- **Ollama**: requests are sent to the local server configured at `127.0.0.1`. In this mode, the plugin does not contact a remote LLM service on its own.

The titles of other notes in the vault are used only to create internal links locally. The plugin does not include telemetry.

LLM-generated output can contain errors, so review all proposed changes before accepting them.

## Development

The project uses TypeScript, npm, and esbuild. Node.js 18 or later is recommended.

```bash
npm install
npm run dev
```

Available commands:

```bash
npm run dev     # compile in watch mode
npm run build   # run TypeScript checks and create a production build
npm run lint    # run ESLint
```

To test the plugin in Obsidian, copy `main.js`, `manifest.json`, and `styles.css` to the root of the plugin folder in your vault, then reload Obsidian.

