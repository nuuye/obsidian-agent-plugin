import { LLMProvider } from '../llm/types/LLMProvider';
import { Analysis } from '../types/Analysis';
import { parseJsonFromLLM } from '../utils/llmJson';

export class NoteAnalyzer {
	constructor(private llm: LLMProvider) {}

	async analyze(content: string): Promise<Analysis> {
		const prompt = `
        Tu es un expert en gestion des connaissances (PKM) et Obsidian.
        Analyse la note Markdown suivante et retourne UNIQUEMENT un objet JSON valide 
        correspondant à cette structure :
        {
            "summary": "résumé string",
            "topics": ["sujet1", "sujet2"],
            "writingStyle": { "language": "fr|en", "tone": "...", "structure": "..." },
            "schema": { 
                "useful": boolean, 
                "score": number 0-1, 
                "type": "graph TD | sequenceDiagram | timeline", 
                "reason": "..." 
            },
            "missingInformation": [{ "topic": "...", "reason": "..." , "origin": "gap | authorDoubt", "quote": "..."}]
        }

        L'objet schema sert à identifier l'utilité et la possibilité d'avoir un schema pour cette note.

        RÈGLE STRICTE POUR LE SCHÉMA :
        Si "useful" est true, la valeur "type" dans l'objet "schema" DOIT obligatoirement être l'une de ces 4 valeurs exactes : "graph TD", "sequenceDiagram", ou "timeline". N'invente AUCUN autre type de schéma.

	        RÈGLE POUR "missingInformation" : Ne signale que les informations indispensables pour comprendre ou appliquer correctement ce que la note contient déjà. N'ajoute pas de concepts généraux, voisins ou simplement intéressants. Avant de signaler un concept comme manquant (origin: "gap"), vérifie s'il est déjà entièrement couvert par une donnée structurée existante dans la note (tableau, liste). Si c'est le cas, NE LE SIGNALE PAS comme "missingInformation", sauf si la RELATION entre les données du tableau n'est elle-même pas expliquée nulle part (dans ce cas, précise dans "reason" que c'est la relation/l'interprétation qui manque, pas la donnée brute elle-même).

	        RÈGLE POUR LES NOTES COURTES : Si la note est un mémo, un snippet, une commande ou une fiche très courte, conserve cette intention. Retourne au maximum UN seul "gap", uniquement s'il évite une erreur concrète ou rend l'exemple inutilisable sans lui. Si la note est déjà autonome, retourne un tableau "missingInformation" vide. Classe toujours les gaps du plus important au moins important.

	        RÈGLE DE CONCISION DU SCHÉMA : Pour un mémo, un snippet ou une simple commande, "schema.useful" doit être false. Un schéma n'est utile que lorsqu'il clarifie réellement plusieurs relations ou étapes déjà au cœur de la note.

        RÈGLE POUR LE DOUTE DE L'AUTEUR (origin: "authorDoubt") : En plus des concepts totalement absents, détecte aussi les passages où l'auteur exprime un doute, une incertitude ou une compréhension approximative d'un concept qu'il mentionne pourtant. Indices typiques : tournures d'euphémisme ou d'atténuation ("en quelque sorte", "dans une certaine mesure", "je crois", "si j'ai bien compris", "un peu"), formulations d'auto-interrogation ("mais alors...?"), ou notes explicites ("à vérifier", "je dois encore comprendre"). Pour chaque cas détecté, ajoute une entrée dans "missingInformation" avec "origin": "authorDoubt", en citant l'extrait exact dans "quote", et en expliquant dans "reason" ce que l'ajout devrait clarifier. Ne signale PAS comme doute une simple prudence académique normale (ex: "généralement", "dans la plupart des cas") — uniquement les cas où l'auteur semble lui-même incertain du concept qu'il décrit.

        RÈGLE POUR LES TERMES TECHNIQUES PRÉCIS (acronymes, suffixes, conventions de nommage) : Si un "gap" concerne la signification d'un acronyme, d'un suffixe ou d'une convention de nommage technique (ex: les suffixes de quantification "_K_M", "_K", "_0"), précise dans "reason" que la réponse doit rester au niveau du COMPORTEMENT/EFFET observable si le sens exact de chaque lettre n'est pas garanti, plutôt que d'exiger une expansion littérale de l'acronyme.
        
        Contenu de la note :
        """
        ${content}
        """
        `;

		const response = await this.llm.generate(prompt);
		return parseJsonFromLLM<Analysis>(
			response,
			'[note analyzer] [error] Error while parsing JSON'
		);
	}
}
