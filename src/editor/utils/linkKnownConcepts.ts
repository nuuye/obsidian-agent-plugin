/**
 * Découpe le contenu en segments "protégés" (à ne jamais modifier) et
 * "normaux" (où la regex de linking peut s'appliquer sans risque) :
 *  - la frontmatter YAML en tête de note (---...---)
 *  - les blocs de code fencés (```..., y compris ```mermaid)
 *  - le code inline (`...`)
 *  - les wikilinks déjà existants ([[...]])
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
    /** Ne lie que la première occurrence de chaque titre dans la note (par défaut : true). */
    onlyFirstOccurrence?: boolean;
}

/**
 * Remplace, de façon déterministe (sans appel LLM), toute mention d'un titre
 * de note existant du Vault par un wikilink Obsidian [[Titre]].
 *
 * Ne touche jamais : la frontmatter, les blocs de code (dont ```mermaid),
 * le code inline, ni le texte déjà à l'intérieur d'un wikilink existant.
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

    // Titres les plus longs d'abord : "Docker Compose" doit être capté avant
    // "Docker" seul, sinon on obtient "[[Docker]] Compose" au lieu de
    // "[[Docker Compose]]".
    const uniqueTitles = [...new Set(vaultTitles)];
    const sortedTitles = uniqueTitles.sort((a, b) => b.length - a.length);
    const alternation = sortedTitles.map(escapeRegExp).join("|");

    if (!alternation) {
        return content;
    }

    // Frontières "façon mot" : on interdit lettre/chiffre/apostrophe juste
    // avant/après le match, pour ne pas matcher "Docker" à l'intérieur de
    // "Dockerfile". \p{L}/\p{N} avec le flag "u" gèrent correctement les
    // accents français, contrairement à \b qui est ASCII-only.
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

                // Si la casse rencontrée diffère du titre canonique (ex: "docker"
                // en minuscule alors que la note s'appelle "Docker"), on utilise
                // la syntaxe [[Titre réel|texte affiché]] pour pointer vers la
                // bonne note tout en gardant le texte original inchangé.
                return matched === canonicalTitle ? `[[${matched}]]` : `[[${canonicalTitle}|${matched}]]`;
            });
        })
        .join("");
}
