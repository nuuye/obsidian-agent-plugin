import { LLMProvider } from "../llm/types/LLMProvider.js";
import { Analysis } from "../types/Analysis.js";
import { mermaidSyntaxExamples } from "../constants.js";
import { linkKnownConcepts } from "../editor/utils/linkKnownConcepts.js";

export class NoteEditor {
    constructor(private llm: LLMProvider) {}

    private cleanLLMOutput(content: string): string {
        let text = content.trim();
        const hasGlobalOpen = /^```(?:markdown)?\r?\n/i.test(text);
        if (hasGlobalOpen) {
            text = text.replace(/^```(?:markdown)?\r?\n/i, "").trim();
            const remainingBackticks = (text.match(/```/g) || []).length;
            if (text.endsWith("```") && remainingBackticks % 2 === 0) {
                text = text.substring(0, text.length - 3).trim();
            }
        }
        return text;
    }

    /**
     * Ajoute un bloc frontmatter YAML avec les aliases en tête de note.
     *
     * IMPORTANT : on construit la frontmatter via un tableau de lignes + join("\n"),
     * PAS via un template literal multi-lignes indenté. Un template literal JS
     * conserve tous les espaces tels quels — l'indentation "visuelle" du code
     * source (pour que ça suive le bloc autour) se retrouve alors DANS la
     * chaîne de sortie, ce qui décale les "---" hors de la colonne 0 et casse
     * la reconnaissance du frontmatter par Obsidian.
     *
     * Chaque alias est aussi entouré de guillemets doubles (avec échappement
     * des guillemets internes) : un topic contenant un ':' ou un caractère
     * spécial YAML casserait sinon le parsing, comme on l'a déjà vu pour les
     * diagrammes Mermaid — même classe de problème, même réflexe de défense.
     */
    private addAliases(content: string, topics: string[]): string {
        if (!topics || topics.length === 0) {
            return content;
        }

        // Si la note a déjà une frontmatter (ex: agent relancé sur une note déjà éditée),
        // on ne duplique pas un second bloc "---" par-dessus.
        if (/^---\r?\n/.test(content)) {
            return content;
        }

        const aliasLines = topics
            .map((topic) => `  - "${topic.replace(/"/g, '\\"')}"`)
            .join("\n");

        const frontmatter = ["---", "aliases:", aliasLines, "---"].join("\n");

        return frontmatter + "\n\n" + content;
    }

	private inferNoteKind(
		content: string
	): "memo" | "concept" | "reference" {
		if (
			/\b(je dois|à comprendre|a comprendre|pourquoi|comment fonctionne|à vérifier|a verifier)\b/i.test(
				content
			)
		) {
			return "concept";
		}

		const codeLength = [...content.matchAll(/```[\s\S]*?```/g)].reduce(
			(total, match) => total + match[0].length,
			0
		);
		if (codeLength > 0 && codeLength / Math.max(content.length, 1) >= 0.25) {
			return "memo";
		}

		const headingCount = (content.match(/^#{1,6}\s+/gm) ?? []).length;
		return headingCount >= 3 ? "reference" : "concept";
	}

    /**
        Improve a note based on its original content and an analysis of it.
     */
    async edit(
        originalContent: string,
        analysis: Analysis,
        existingNotes: string[],
        onToken?: (chunk: string) => void
    ): Promise<string> {
		const noteKind = analysis.noteKind ?? this.inferNoteKind(originalContent);
		const isMemo = noteKind === "memo";
		const detectedGaps = (analysis.missingInformation ?? []).filter(
			(m) => m.origin === "gap"
		);
		const gaps = isMemo ? detectedGaps.slice(0, 1) : detectedGaps.slice(0, 3);
        const doubts = (analysis.missingInformation ?? []).filter((m) => m.origin === "authorDoubt");
		const adaptationRules = isMemo
			? `
			RÈGLE ABSOLUE — MÉMO / SNIPPET :
			- Conserve le format de mémo ou de snippet. Ne transforme pas la note en tutoriel ou en cours.
			- Ajoute au maximum 40 mots au total, seulement s'ils sont indispensables pour utiliser correctement l'information existante.
			- N'ajoute aucun nouveau titre ou sous-titre, aucune introduction, aucune conclusion et aucune information générale voisine.
			- Pour un gap, ajoute au maximum une phrase courte. Si l'explication exige davantage, n'ajoute rien.
			- Une commande accompagnée d'une phrase suffisante doit rester une commande accompagnée d'une phrase.
			`
			: noteKind === "concept"
				? `
			RÈGLE ABSOLUE — NOTE CONCEPTUELLE :
			- Apporte un niveau d'explication intermédiaire : assez pour comprendre les notions présentes, jamais un cours exhaustif.
			- Explique chaque notion que l'auteur dit explicitement devoir comprendre, en une ou deux phrases courtes par notion.
			- Ajoute au maximum 120 mots au total et n'introduis aucun concept voisin qui n'est pas nécessaire à la compréhension de la note.
			- Reprends le format dominant de l'auteur : phrases courtes si la note utilise des phrases courtes, listes seulement si elles rendent plusieurs éléments plus lisibles.
			- Conserve les explications existantes pertinentes, notamment les définitions et exemples déjà écrits.
			`
				: `
			RÈGLE ABSOLUE — NOTE DE RÉFÉRENCE :
			- Complète uniquement les lacunes directement liées aux sections existantes.
			- Préserve la structure, la densité et le format dominants de l'auteur.
			- Reste synthétique : deux phrases ou trois puces au maximum par information manquante.
			`;

        const commonGoldenRules = `
			[IMPORTANT] RESPECTE LE FORMAT DOMINANT DE L'AUTEUR. N'utilise une liste à puces que si elle rend plusieurs éléments distincts plus lisibles.
			-> Règle 1 : N'ajoute un sous-titre Markdown que si la note possède déjà une structure comparable et que plusieurs paragraphes le nécessitent réellement.
            -> Règle 1bis : N'utilise pas des mots compliqués. Si le sujet est technique l'expliquation doit être comprise facilement.
            -> Règle 2 : N'utilise JAMAIS du texte en gras comme substitut à un titre Markdown. Si tu structures avec des sous-parties, utilise systématiquement ### (ou ##### selon le niveau de la note), jamais du gras en début de ligne.
            -> Règle 3 : INSÈRE l'enrichissement à l'endroit le plus cohérent avec la structure narrative existante (par exemple après un exemple qui illustre déjà le concept, pas avant). Ne casse jamais un enchaînement logique existant (explication → exemple → conclusion).
            -> Règle 4 : Si l'information est déjà présente ailleurs dans la note (tableau, phrase existante), NE LA RÉPÈTE PAS. Reste aussi concis que possible : privilégie une phrase dense plutôt qu'une liste si le concept est simple.
			-> Règle 5 : COHÉRENCE FACTUELLE ET DOMAINE. Avant d'ajouter un exemple ou un chiffre, vérifie qu'il ne contredit AUCUNE donnée déjà présente dans la note (tableaux inclus). N'utilise QUE des exemples appartenant au domaine déjà couvert par la note.
            -> Règle 6 : Chaque point d'une liste doit apporter une information distincte des autres — ne réutilise jamais la même formulation pour deux entrées différentes.
            -> Règle 7 : COHÉRENCE INTERNE DES INTERPRÉTATIONS. Si tu interprètes un symbole ou une convention (ex: le "<" d'un tableau) dans un exemple, applique EXACTEMENT LA MÊME interprétation à tous les exemples suivants du même symbole dans le même paragraphe. Ne dis jamais "moins de X" pour un cas puis "plus de X" pour un autre cas du même symbole — vérifie la cohérence logique entre tes propres phrases avant de les inclure.
            `;

        const gapsPrompt =
            gaps.length > 0
                ? `5. ENRICHISSEMENT (concepts absents) : Tu dois expliquer les concepts suivants, absents de la note : ${gaps
                      .map((m) => m.topic)
                      .join(", ")}.
            -> Règle d'or 2bis : SUPPRIME ou REFORMULE les phrases de la note originale qui indiquaient un besoin d'apprendre ou de comprendre ces concepts (ex: "Je dois encore comprendre..."). Inclus les explications dans une ou plusieurs sous partie si nécessaire.

            `
                : "";

        const doubtsPrompt =
            doubts.length > 0
                ? `${
                      gaps.length > 0 ? "5bis" : "5"
                  }. CLARIFICATION (doutes de l'auteur) : L'auteur exprime un doute ou une incertitude sur les points suivants :
            ${doubts
                .map(
                    (m, i) =>
                        `   ${i + 1}. Concept : "${m.topic}" — Extrait concerné : "${
                            m.quote ?? ""
                        }" — Ce qu'il faut clarifier : ${m.reason}`
                )
                .join("\n            ")}

            -> FORMAT DE SORTIE OBLIGATOIRE POUR CHAQUE DOUTE : une reformulation qui REMPLACE directement l'extrait cité, intégrée dans le paragraphe existant. JAMAIS une nouvelle section, un nouveau titre, ou une liste à puces séparée. Le doute doit disparaître DANS le texte, pas être suivi d'un bloc d'explication à côté.
            
            -> Exemple de transformation attendue :
                AVANT (extrait de note) : "Mais alors les Implications ?\\nPerte de précision pour des longs prompts ou des longs calculs."
                APRÈS (attendu)         : "Cela implique une perte de précision pour les prompts longs ou les calculs complexes, un effet plus marqué sur les quantifications élevées comme Q4 ou Q5."
                (Remarque : pas de titre, pas de gras, pas de liste — une reformulation fondue dans le texte existant.)

            -> Règle d'or A : NE TE CONTENTE PAS D'AJOUTER une explication à côté de l'extrait. REFORMULE DIRECTEMENT la phrase concernée pour intégrer la clarification, en gardant l'extrait original comme point d'ancrage (même idée, formulation plus assurée et précise).
            -> Règle d'or B : Supprime la tournure de doute elle-même (ex: "en quelque sorte", "je crois", "dans une certaine mesure") une fois la clarification intégrée — l'auteur n'a plus besoin d'exprimer d'incertitude sur un point désormais expliqué.
            -> Règle d'or C : Ne transforme pas une prudence académique légitime (ex: "généralement", "dans la plupart des cas") en affirmation absolue. Le but est de clarifier le concept, pas de supprimer toute nuance justifiée.
            `
                : "";

		const useSchema =
			!isMemo &&
			analysis.schema.useful &&
			analysis.schema.score > 0.6;
        let schemaBlock: string;

        if (useSchema) {
            const schemaConfig = mermaidSyntaxExamples[analysis.schema.type];
            if (!schemaConfig) {
                throw new Error(
                    `Type de schéma Mermaid inconnu retourné par l'analyse : "${analysis.schema.type}". ` +
                        `Valeurs attendues : ${Object.keys(mermaidSyntaxExamples).join(", ")}.`
                );
            }

            schemaBlock = `SCHÉMA MERMAID OBLIGATOIRE :
                    - Ajoute TOUJOURS un schéma Mermaid à la fin de la note.
                    - Le diagramme doit se limiter STRICTEMENT au sujet suivant, tel qu'identifié par l'analyse : "${analysis.schema.reason}". 
                        N'y intègre AUCUNE autre section ajoutée ailleurs dans la note (ex: un enrichissement ou une clarification ajoutés séparément), sauf si elle fait partie intrinsèque du même flux de relations décrit ci-dessus.
                    - Utilise IMPÉRATIVEMENT la syntaxe suivante, propre au type "${analysis.schema.type}" (ne mélange jamais les syntaxes d'autres types):

                    ${schemaConfig.example}

                    - RÈGLE POUR CE TYPE : ${schemaConfig.rule}
                    - N'invente AUCUNE relation causale ou séquentielle entre des concepts qui sont en réalité indépendants. Si les concepts sont des dimensions parallèles (pas un flux), utilise un format adapté.
                    - Le Schéma doit commencer par \`\`\`mermaid et se terminer par \`\`\`.
                    - REGLE FINALE ET ABSOLUE : Le Schema doit être CONSCIT et faire un résumé du sujet.`;
        } else {
            schemaBlock = "Ne PAS ajouter de schéma.";
        }

        const prompt = `Tu dois proposer une version améliorée de cette note Obsidian.
        
        Règles à respecter STRICTEMENT :
        1. Corriger les fautes et le formatage Markdown (y compris les erreurs de locutions et expressions figées, ex: "en quelques sortes" → "en quelque sorte").
        2. Préserver le style de l'auteur : Ton = ${
            analysis.writingStyle.tone
        }. Le texte ajouté doit être INDISCERNABLE de l'original en termes de densité et de format — n'invente pas de titres en gras façon "listicle" si l'auteur n'en utilise pas ailleurs dans la note.
        3. Mets en gras les concepts clés de la note ou les mots qui sont importants pour comprendre un concept rapidement.
        4. Ne supprimer aucune information existante pertinente. (Tu es autorisé à supprimer ou reformuler les phrases obsolètes ou exprimant un doute selon les règles d'enrichissement/clarification si elles s'appliquent).
        ${gapsPrompt}
        ${doubtsPrompt}
        ${gapsPrompt || doubtsPrompt ? commonGoldenRules : ""}
		${adaptationRules}
		RÈGLE ABSOLUE D'UNICITÉ : Toute reformulation doit REMPLACER la formulation originale. Ne conserve jamais côte à côte une phrase originale et sa version corrigée, enrichie ou mise en forme. Relis la sortie et supprime toute répétition exacte ou quasi identique.
        6. ${schemaBlock}
        7. NE PLACE JAMAIS ta réponse finale dans un bloc \`\`\`markdown global. Retourne le texte directement.
        
        Retourne UNIQUEMENT le code Markdown de la note modifiée. Ne fais pas d'introduction ou de conclusion.

        Contenu original :
        """
        ${originalContent}
        """`;

        const modifiedContent = await this.llm.generate(prompt, { onToken });
        const cleaned = this.cleanLLMOutput(modifiedContent);
        const withAliases = this.addAliases(cleaned, analysis.topics);
        return linkKnownConcepts(withAliases, existingNotes);
    }
}
