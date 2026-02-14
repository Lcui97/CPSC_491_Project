# Obsidian-Style Note & Graph Implementation

## File structure

```
frontend/src/
  api/
    client.js                 # api(), apiUpload() — no change
  store/
    brainStore.js             # Zustand: nodeListCache, graphCache, nodeCache, fetchNodes, fetchGraph, fetchNode, updateNode, backlinks, related
  pages/
    NoteView.jsx              # Obsidian note layout: NoteSidebar + editor + ContextPanel
    BrainGraphView.jsx        # Graph page: filters + GraphCanvas
  components/note/
    NoteSidebar.jsx           # Left: search (title+tags), sort (recent/alpha), tag filter, paginated node list
    MarkdownEditor.jsx        # Edit / Preview / Split, autosave debounce 600ms, Cmd+S save
    ContextPanel.jsx          # Right: backlinks, related nodes
    GraphCanvas.jsx           # react-force-graph-2d: nodes, edges, filters, local graph mode
    QuickSwitcher.jsx         # Cmd/Ctrl+K modal: search brains and notes, jump to note

backend/app/
  models/brain.py             # Node (markdown_content, tags, updated_at), NodeRelationship (edge_type, weight)
  routes/brain.py             # GET /brain/<id>/nodes (paginated, q, tag, sort), GET/PUT /nodes/<id>, GET backlinks, GET related, GET /brain/<id>/graph
```

## Routes

| Route | Purpose |
|-------|---------|
| `/brain/:brainId/notes` | Note view, no node selected |
| `/brain/:brainId/notes/:nodeId` | Note view, node open |
| `/brain/:brainId/graph` | Force-directed graph view |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/brain/:brainId/nodes` | List nodes (page, per_page, q, tag, sort=recent\|alpha) |
| GET | `/api/nodes/:nodeId` | Single node |
| PUT | `/api/nodes/:nodeId` | Update title, markdown_content, tags |
| GET | `/api/nodes/:nodeId/backlinks` | Nodes that link to this node |
| GET | `/api/nodes/:nodeId/related` | Graph neighbors + semantic (Pinecone) if available |
| GET | `/api/brain/:brainId/graph` | Nodes + edges for graph (cache on client) |

## Hotkeys

- **Cmd/Ctrl+K**: Quick switcher (search and jump to brain or note).
- **Cmd/Ctrl+S**: Force save current note (in NoteView).

## Database

- **Node**: `markdown_content`, `tags` (JSON array), `updated_at` added. Existing DBs may need migrations to add these columns if they were created before this change.
- **NodeRelationship**: `edge_type`, `weight` added.

## Implementation steps (done)

1. Backend: Extended Node and NodeRelationship models; added GET/PUT node, backlinks, related, graph endpoint; paginated list with search/sort/tag.
2. Frontend: Installed react-force-graph-2d, react-markdown, zustand.
3. Zustand store for caching brain list, node list per brain, graph per brain, single node.
4. NoteView: sidebar (NoteSidebar) + main (title + MarkdownEditor) + ContextPanel; autosave; Cmd+S.
5. BrainGraphView: filters (tag, edge type, min weight, local graph N-hop) + GraphCanvas (force graph, node size by degree, color by tag).
6. QuickSwitcher: Cmd+K, search API, navigate to brain or note.
7. Routing: /brain/:brainId/notes, /brain/:brainId/notes/:nodeId, /brain/:brainId/graph. Home sidebar opens NoteView for a brain.
