# DTF Halftone Maker

Application web de transformation d'images en **demi-teinte (halftone)** optimisée pour le transfert DTF (Direct-to-Film). Tout le traitement est effectué **localement dans le navigateur** — aucune image n'est jamais envoyée sur un serveur.

![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)

## 🚀 Installation

```bash
cd DTFHalftoneMaker
npm install
npm run dev
```

## ✨ Fonctionnalités

- **Upload par drag & drop** ou sélection de fichier
- **5 types de points** : Rond, Carré, Ellipse, Losange, Ligne
- **Contrôles complets** : grille, angle, densité, seuil, valeurs manuelles
- **Traitement en Web Worker** — UI réactive
- **Redimensionnement auto** des images > 2500px
- **Annuler / Rétablir** (Ctrl+Z / Ctrl+Y)
- **Export PNG** transparent + **Export SVG** vectoriel
- **Prévisualisation** sur fond damier

## 📁 Structure

```
src/
├── types/halftone.ts          # Interfaces TypeScript
├── utils/
│   ├── color.ts               # Luminance, couleur moyenne
│   ├── dot-shapes.ts          # 5 formes de points
│   └── halftone-engine.ts     # Algorithme principal
├── workers/halftone.worker.ts # Web Worker
├── composables/
│   ├── useHalftone.ts         # Orchestrateur
│   ├── useHistory.ts          # Undo/redo
│   └── useImageLoader.ts      # Chargement images
├── components/                # Vue components
├── App.vue, main.ts, style.css
```

## 🎨 Ajouter une Forme

1. Créer une fonction dans `src/utils/dot-shapes.ts`
2. L'ajouter à `dotShapeDrawers`
3. Ajouter au type `DotShape` dans `types/halftone.ts`
4. Ajouter l'icône SVG dans `DotShapeSelector.vue`

## Tests

```bash
npx vitest run
```

## 📄 Licence

MIT
