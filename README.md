# Granule Cell Quiz

An interactive quiz on olfactory bulb granule cells (GCs), built from papers in my Zotero library and the olfactory bulb chapter of Shepherd's *The Synaptic Organization of the Brain*. There are 142 questions across eight topics:

- anatomy and synapses
- dendritic computation
- the bulb circuit
- in vivo activity and brain state
- cortical feedback
- neuromodulation
- adult neurogenesis
- learning

There are two kinds of question. **Predict the result** describes an experiment and asks what happened. **Concept check** asks about a mechanism or fact. Each answer shows the figure panel from the paper, with a DOI link and a `zotero://` link that opens the item in Zotero.

## Use

- Open `index.html` in a browser. It also works straight from the file system, with no server.
- **Quiz tab:** pick topics, question type, difficulty and length. The "Missed before" pool re-asks questions you got wrong last time. Keyboard: `1`–`4` answer, `Enter` goes to the next question, `Esc` closes a zoomed figure.
- **Browse tab:** every card with its answer, explanation and figure, searchable. Use it as a literature review.
- **Papers tab:** each source paper and the cards that use it.
- **Removing a card:** "Remove this card", at the bottom of any answer, hides that card from quizzes and Browse. Removed cards are listed at the end of Browse with their IDs, to restore them or to delete them from `data.js` for good.
- **Build stamp:** the short hash next to the title is the commit the live site was built from, linked to GitHub. A local copy shows "local copy".

Progress and removed cards are kept in the browser's `localStorage`, so they are per browser and per device.

## Files

- `index.html`, `style.css`, `app.js`: the app (vanilla JS, no dependencies).
- `data.js`: questions and paper metadata (`window.QUIZ`).
- `img/`: one cropped figure panel per question, named by question id.
- `version.js`: the build stamp. `.github/workflows/pages.yml` overwrites it with the commit hash when it deploys to GitHub Pages, and adds that hash to the script and stylesheet URLs so a cached page can't mix old and new files.

## Copyright note

The figure panels are reproduced from published papers for private study. Many are under publisher copyright, so keep this repository private. A GitHub Pages site is publicly reachable even when its repository is private, except on GitHub Enterprise Cloud with private Pages. If you want a public version, keep only panels from CC-BY papers (eLife, PLOS, Nature Communications, Scientific Reports, Cell Reports, Frontiers) and replace the others with links.
