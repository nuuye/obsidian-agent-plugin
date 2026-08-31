interface MermaidConfig {
	rule: string;
	example: string;
}

export const mermaidSyntaxExamples: Record<string, MermaidConfig> = {
	'graph TD': {
		rule: 'Chaque flèche DOIT avoir un label explicatif explicite (Syntaxe : A -->|label| B). RÈGLE CRITIQUE : si le texte à l\'intérieur d\'un nœud (entre [ ] ou { }) contient des parenthèses, virgules ou deux-points, ENTOURE-LE de guillemets doubles (ex: A["Concept (détail)"] et NON A[Concept (détail)]). Dans une instruction class, sépare plusieurs identifiants par des virgules SANS espace (ex: class A,B,C root). Utilise un style sobre et lisible en adéquation avec un thème sombre. Utilise des couleurs vives.',

		example: `%%{init: {
        "theme": "base",
        "themeVariables": {
        "background": "#1E2329",
        "primaryTextColor": "#E6EDF3",
        "lineColor": "#64748B",
        "textColor": "#E6EDF3",
        "edgeLabelBackground": "#1E2329"
        }
        }}%%
        graph TD
            A["Concept principal"] -->|Action/Lien| B["Catégorie"]
            B -->|Mène à| C{"Condition"}
            C -->|Oui| D["Concept D"]
            C -->|Non| E["Concept E"]

            classDef root fill:#1F6FEB,color:#FFFFFF,stroke:#58A6FF,stroke-width:2px
            classDef category fill:#252B33,color:#E6EDF3,stroke:#3B4654,stroke-width:1px
            classDef item fill:#1E2329,color:#E6EDF3,stroke:#3B4654,stroke-width:1px

            class A root
            class B,C category
            class D,E item`,
	},

	sequenceDiagram: {
		rule: "Utilise 'participant' pour déclarer les acteurs. Les flèches (->>) doivent clairement indiquer l'action envoyée d'un participant à l'autre. Si un message contient des deux-points, entoure-le de guillemets doubles.",
		example: `sequenceDiagram
    participant A as Acteur A
    participant B as Système B
    A->>B: Requête initiale
    B-->>A: Réponse avec données`,
	},

	timeline: {
		rule: "Organise chronologiquement par 'section'. Pas de flèches ou de liaisons, uniquement des événements formatés ainsi : 'Événement : Détail'. Évite d'ajouter un deux-points supplémentaire à l'intérieur du texte d'un événement ou d'un détail, car le premier ':' sert déjà de séparateur syntaxique.",
		example: `timeline
    title Titre de la chronologie
    section Phase 1
        Événement A : Détail de l'événement A
        Événement B : Détail de l'événement B
    section Phase 2
        Événement C : Détail de l'événement C`,
	},
};
