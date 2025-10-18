# Tech Radar — Bureau d'études (Web, Cloud, IA, IoT)

Ce dépôt contient :
- `docs/radar/**.md` : fiches descriptives des blips par quadrant.
- `scripts/generate-radar.ts` : script Deno pour agréger les frontmatters en `build/tech-radar.json`.
- `build/tech-radar.json` : sortie générée.
- `CHANGELOG.md`, `process.md` : règles de gouvernance et historique.

## Utilisation rapide

```bash
deno run -A scripts/generate-radar.ts
cat build/tech-radar.json
```

> Prérequis : [Deno](https://deno.land/) installé.

## Contribuer
- Une fiche = un fichier `.md` avec frontmatter (voir exemples).
- Les revues ont lieu chaque trimestre ; maj semestrielle publique.
