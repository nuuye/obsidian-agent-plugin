/**
 * Splits content into protected segments and regular text where automatic
 * linking is safe. Protected segments include YAML frontmatter, fenced code
 * blocks, inline code, and existing wikilinks.
 */
function splitProtectedSegments(content: string): { text: string; protected: boolean }[] {
    const protectedPattern = /(^---\r?\n[\s\S]*?\r?\n---\r?\n)|(```[\s\S]*?```)|(`[^`\n]*`)|(\[\[[^\]]*\]\])/g;

    const segments: { text: string; protected: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = protectedPattern.exec(content)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ text: content.slice(lastIndex, match.index), protected: false });
        }
        segments.push({ text: match[0], protected: true });
        lastIndex = protectedPattern.lastIndex;
    }
    if (lastIndex < content.length) {
        segments.push({ text: content.slice(lastIndex), protected: false });
    }

    return segments;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LinkKnownConceptsOptions {
    /** Links only the first occurrence of each title by default. */
    onlyFirstOccurrence?: boolean;
}

/**
 * Deterministically replaces mentions of existing vault note titles with
 * Obsidian wikilinks, without involving the LLM.
 *
 * Frontmatter, fenced code (including Mermaid), inline code, and existing
 * wikilinks are never modified.
 */
export function linkKnownConcepts(
    content: string,
    vaultTitles: string[],
    options: LinkKnownConceptsOptions = {}
): string {
    const onlyFirstOccurrence = options.onlyFirstOccurrence ?? true;

    if (!vaultTitles || vaultTitles.length === 0) {
        return content;
    }

    // Match longer titles first so "Docker Compose" wins over "Docker" and
    // does not become the partial link "[[Docker]] Compose".
    const uniqueTitles = [...new Set(vaultTitles)];
    const sortedTitles = uniqueTitles.sort((a, b) => b.length - a.length);
    const alternation = sortedTitles.map(escapeRegExp).join("|");

    if (!alternation) {
        return content;
    }

    // Unicode-aware boundaries prevent a title such as "Docker" from matching
    // inside "Dockerfile". Unlike \b, \p{L} and \p{N} handle accented text.
    const titleRegex = new RegExp(`(?<![\\p{L}\\p{N}'’])(${alternation})(?![\\p{L}\\p{N}'’])`, "gu");

    const alreadyLinked = new Set<string>();

    const segments = splitProtectedSegments(content);

    return segments
        .map((segment) => {
            if (segment.protected) {
                return segment.text;
            }

            return segment.text.replace(titleRegex, (matched) => {
                const canonicalTitle = sortedTitles.find((t) => t.toLowerCase() === matched.toLowerCase()) ?? matched;
                const key = canonicalTitle.toLowerCase();

                if (onlyFirstOccurrence && alreadyLinked.has(key)) {
                    return matched;
                }
                alreadyLinked.add(key);

                // Preserve the visible casing with an alias while targeting
                // the canonical vault title, e.g. [[Docker|docker]].
                return matched === canonicalTitle ? `[[${matched}]]` : `[[${canonicalTitle}|${matched}]]`;
            });
        })
        .join("");
}
