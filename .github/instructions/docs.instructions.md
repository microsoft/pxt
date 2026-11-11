---
description: "Structure for human-readable docs with a trailing Agent Notes section"
applyTo: "docs/**/*.md, common-docs/**/*.md"
---

# PXT Documentation Instructions

Apply this structure when you write a new doc page or substantially revise one.
Don't restructure unrelated existing pages.

## Write for humans first

- Write each section for the people who will use the feature, such as extension
  authors, target maintainers, or educators. Lead with what the feature does and
  when to use it, not with how it is implemented.
- Keep the main sections short. Prefer plain explanations, tables, and examples
  over lists of edge cases.
- Phrase the prose the way a person on the team would explain the feature, in
  natural sentences. Reviewers will reject PRs whose human-facing docs don't
  read as if a person wrote them.
- Agent Notes are an addition to the human-facing sections, not a replacement.
  Every page still needs a complete explanation for human readers.

## Define terms at the top

- Near the top of the page, add a short "Key terms" section, usually a table,
  that gives a clear one-line meaning for every concept the page relies on.
- Use those terms consistently throughout the page.

## Give every example a use case

- Before each code or configuration example, add a one-line `**Use case:**` that
  describes the real situation the example solves.
- Keep examples generic enough for any target unless the page is target-specific.
  Don't present a target as using a feature that it doesn't actually use yet.

## Move agent-oriented detail to "Agent Notes"

- End the page with a `## Agent Notes` section. Put it after every other section.
- Move material that mainly helps contributors or future AI agents into that
  section. This includes narrow behavior descriptions, edge cases, precedence
  rules, fallbacks, error handling, invariants, migration cautions, and asides.
- Group the notes under `###` subheadings by topic, using concise bullets.
- Keep each note accurate to the current code. When code behavior changes,
  update the matching note.

## Links

- Link to other docs pages with site-relative paths, such as
  `[Extension localization](/extensions/localization)`.
- When linking to a heading, check the anchor on the published page at
  `https://makecode.com/<path>`, rather than guessing it.
