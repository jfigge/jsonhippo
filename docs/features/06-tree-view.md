# 06 — Tree View

## Context
Stack.hu's tree view is the part the owner likes most. JsonHippo's tree view renders the parsed AST as a collapsible tree. It is the base for the filter in `07-tree-filter.md`.

## Goal
A fast, collapsible tree rendered from the AST, which stays usable on large documents.

## Design
- A `TreeView` class (jQuery for the DOM): `new TreeView($container, { onSelect })`.
- Each node is a `jh-node` element showing:
  - an expand/collapse toggle for objects and arrays;
  - the key, or the index for array items;
  - the type icon: `{}`, `[]`, string, number, boolean, null. Icons are SVG with `currentColor` and differ by shape;
  - the value for primitives, or a child count for containers (for example `{ 12 }`, `[ 300 ]`).
- States: `jh-node--collapsed`, `jh-node--expanded`, `jh-node--selected`.
- **Lazy rendering**: a container's children are created in the DOM the first time it is expanded. The initial render shows the root and the first level only.
- **Selecting a node** shows its path (`$.items[3].name`) in a detail bar, with buttons to **copy the path** and **copy the value** (the value formatted from the AST).
- **Toolbar**: Expand all (with a confirmation above about 5,000 nodes), Collapse all, Expand to level N.
- If the input is invalid, the Tree tab shows the same error as the Text tab, with a "Go to error" button that switches to Text and jumps to the position. It does **not** show an empty or broken tree.
- Every node keeps a reference to its AST node, so it can link back to its source position. A "Show in text" action jumps to that position in the Text tab.

## Steps
1. Implement `TreeView` rendering from the AST, using lazy children.
2. Add the toggle, selection, detail bar and copy actions.
3. Add the Expand/Collapse all and level controls.
4. Add the invalid-input state and the "Show in text" link.

## Acceptance
- A 5 MB file renders its first level in under about 500 ms.
- Expanding a node with 10,000 children doesn't freeze the page for more than about 1 s.
- Copy path gives a valid path. Copy value gives that subtree formatted.
- Invalid input shows the error, never a partial tree.
- "Show in text" places the caret on the node's source position.

## Constraints
- jQuery is allowed here. The AST must not be changed by the view.
- Keyboard: arrow keys move between nodes, Left/Right collapse and expand, and Enter selects.

## Verify
- Manual run with the valid fixtures, including the large one.
- Use devtools Performance to check the render times above.
