# 07 — Tree Filter

## Context
Stack.hu's tree can't be filtered, which makes big documents painful to explore. This is one of the three reasons JsonHippo exists. The owner wants it built with jQuery.

## Goal
A live filter box over the tree that narrows it to matching nodes, while keeping each match's ancestors visible so it is clear where the match sits.

## Design
- A filter input (`jh-filter`) above the tree, with a match count ("23 matches") and Previous/Next buttons to step through the matches.
- **Match scope** is a toggle with three options: **Keys**, **Values** or **Both** (default Both).
- **Options**: case-sensitive (default off), and a regex mode (an invalid regex shows an inline error and does not throw).
- **Matching runs against the AST**, not the DOM, because the tree renders lazily (see 06) and most nodes aren't in the DOM yet. The steps are:
  1. Walk the AST and collect the paths of matching nodes.
  2. Expand and render the ancestors of every match.
  3. Mark matches with `jh-node--match`, highlight the matched text, and hide branches with no match (`jh-node--filtered-out`).
- **Debounce** the input by about 250 ms. Esc clears the filter, which restores the previous expand/collapse state.
- **Path filter (stretch goal)**: if the query starts with `$`, treat it as a simple path such as `$.items[*].name` and show only those nodes.

## Steps
1. Write an AST search function that returns the matching paths. Keep it pure JS so it can be tested.
2. Build the `TreeFilter` class (jQuery) that drives `TreeView`: it expands ancestors, marks matches and hides non-matches.
3. Add the match count, Previous/Next and keyboard shortcuts (`/` focuses the filter, Enter goes to next, Shift+Enter to previous).
4. Add the scope toggle, case and regex options.
5. Write a unit test for the AST search function.

## Acceptance
- A filter of `zip` on a large address list shows every `zip` key with its ancestors, and hides everything else.
- Matches inside collapsed or not-yet-rendered branches are found.
- Clearing the filter restores the previous tree state.
- The match count is correct, and Previous/Next cycle through matches and scroll each into view.
- An invalid regex shows an inline error and the tree is left unchanged.

## Constraints
- jQuery is used for the DOM work. The search over the AST stays pure JS.
- On a 5 MB document, the filter returns results in under about 500 ms.

## Verify
- `make test` for the AST search function.
- Manual run on the large fixture, trying keys, values, regex and clearing the filter.
