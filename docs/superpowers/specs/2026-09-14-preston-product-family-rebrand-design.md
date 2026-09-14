# Preston Product Family Rebrand Design

Date: 2026-09-14
Status: Proposed for review
Repository: `ppodolske/preston-run`
Docs branch: `docs/preston-product-family-rebrand`
Implementation sequencing: after preston.ai v0.14.0 release gates are complete

## 1. Summary

The Preston projects have evolved beyond the names and boundaries they started with. This design establishes one coherent product family without performing disruptive infrastructure renames.

The approved naming direction is:

- **Preston** — umbrella brand.
- **preston.ai** — personal intelligence and orchestration platform.
- **Atlas** — places, parks, trips, camping, maps, and exploration.
- **Form** — training, recovery, running, strength, body metrics, and physical progress.
- **Archive** — private creative story library and long-term story/canon preservation.

The primary authenticated Preston navigation becomes:

`Home · Atlas · Form · Archive`

This is a product/UI rebrand first. Existing repository names, domains, Railway project/service identifiers, database tables, authentication identifiers, cookies, storage keys, API contracts, and deployment topology remain unchanged unless a later technical requirement independently justifies changing them.

## 2. Why this change

The current project names reflect earlier versions of the products rather than their present roles.

### 2.1 preston.ai

`preston.ai` has become the intelligence and orchestration layer: morning digest, Life Admin, Gmail-derived intelligence, travel intelligence, authentication, and links into other Preston systems. It should remain the platform name rather than being treated as one peer application among unrelated projects.

### 2.2 Parks → Atlas

The parks project has expanded beyond a park checklist. It now covers trip planning, park detail, destinations, routes/stops, camping logistics, maps, and travel-related planning. **Atlas** gives this product enough scope to represent places and journeys without discarding parks as a first-class feature.

Within Atlas, **Parks** remains a feature/category label where it is semantically correct.

### 2.3 Dose & Scale → Form

Dose & Scale has expanded far beyond weight/measurement tracking. It now represents training history, planned-vs-actual workouts, strength, running, Garmin/recovery data, body metrics, trends, and progress intelligence.

**Form** deliberately carries several meanings: physical form, athletic form, training condition, body composition, and progress over time. It fits the current product without restricting future development to one sport or one metric.

### 2.4 Archive remains Archive

Archive already describes the product accurately. It is a persistent private repository for stories, images, canon, revisions, and continuation. Renaming it would add novelty without improving comprehension.

## 3. Product architecture

### 3.1 Umbrella brand

The family brand is **Preston**.

The preferred verbal hierarchy is:

- Preston — the overall personal software ecosystem.
- preston.ai — the intelligence/orchestration platform.
- Atlas — the place and journey product.
- Form — the physical performance/progress product.
- Archive — the creative story product.

UI lockups may use either the bare product name or a Preston family treatment such as `Preston / Atlas`, but product pages should not become visually cluttered with repeated `Preston /` prefixes.

### 3.2 Product roles

| Product | Primary role | Representative capabilities |
| --- | --- | --- |
| preston.ai | Personal intelligence + orchestration | Home, Morning Digest, Life Admin, Gmail intelligence, Travel Intelligence, cross-product navigation |
| Atlas | Places + journeys | Trips, parks, places, maps, camping, logistics, travel history/planning |
| Form | Physical self + performance | Training, recovery, running, strength, body metrics, progress intelligence |
| Archive | Creative memory | Stories, inline images, canon, editing, continuation, preservation |

### 3.3 Navigation language

The primary Preston family navigation should use:

- **Home** — preston.ai home/dashboard.
- **Atlas** — current parks/travel product.
- **Form** — current Dose & Scale product.
- **Archive** — story archive.

Do not use `preston.ai` as the Home nav label when `Home` is clearer. The preston.ai identity belongs in the page/app chrome and metadata.

## 4. Brand language

### 4.1 Naming rules

Visible product copy should use these exact forms:

- `preston.ai`
- `Atlas`
- `Form`
- `Archive`

Avoid:

- `Preston.ai` unless sentence typography absolutely requires it;
- `PRESTON.AI` as ordinary body copy;
- `Preston Atlas`, `Preston Form`, or `Preston Archive` as mandatory page titles;
- `Dose & Scale` in user-facing current-product copy after migration;
- `Parks` as the product name after migration.

Historical release notes may retain historical product names where changing them would misrepresent history.

### 4.2 Suggested descriptors

Descriptors are optional secondary copy, not part of the formal product name:

- preston.ai — `Personal intelligence`
- Atlas — `Places and journeys`
- Form — `Training and progress`
- Archive — `Stories and canon`

Short descriptors should be preferred over marketing taglines.

### 4.3 Visual family

All four products should retain the established Preston visual language rather than receiving unrelated identities.

Shared family traits should include:

- the existing Preston typography direction;
- the existing restrained, outdoors-influenced brand palette;
- consistent border radii, spacing language, card hierarchy, and icon treatment where practical;
- consistent favicon/app-icon family treatment;
- product-specific identity expressed primarily through name, icon/symbol, and content rather than an entirely different design system.

This rebrand does **not** require redesigning every screen into identical components. Product-specific UX remains appropriate.

## 5. Application boundaries

### 5.1 preston.ai remains the platform

preston.ai owns cross-domain intelligence and orchestration. It should surface summaries and links rather than duplicate the full specialist interfaces of Atlas, Form, or Archive.

Examples:

- preston.ai may show a training/recovery summary but Form owns detailed training history and analysis.
- preston.ai may show upcoming Trip intelligence but Atlas owns rich place/park/trip planning experiences.
- preston.ai may link to Archive but should not become a story editor.

### 5.2 Atlas and Travel Intelligence

Atlas and preston.ai Travel Intelligence are complementary, not competing travel systems.

- preston.ai owns canonical personal-intelligence records such as Trips, Bookings, Booking Legs, linked Life Admin Events, and Gmail-derived travel intelligence.
- Atlas owns exploration/planning UX: places, parks, maps, camping, stop planning, and richer journey planning.

Future integrations may share/deep-link Trip identifiers, but this rebrand does not require a new cross-repo data model or synchronization layer.

### 5.3 Form and preston.ai

Form remains the source for detailed physical-performance data and analysis. preston.ai may surface summary intelligence and navigation into Form.

The Morning Digest remains in preston.ai; it should not move back into Form.

### 5.4 Archive

Archive remains intentionally separate because its data model, privacy expectations, and creative workflow differ from the operational data in preston.ai.

## 6. Public/private boundaries

The naming change must not weaken current access boundaries.

- preston.ai remains authenticated except for intentionally public surfaces.
- Form remains private/authenticated.
- Archive remains private/authenticated and `noindex`.
- Atlas preserves the existing requirement that park-reference/public park pages remain publicly accessible where intended.

A shared Preston family nav must not accidentally expose private data on public Atlas pages. Public Atlas pages may show branding and safe navigation, but must not render authenticated Preston summaries, Life Admin information, Form metrics, Archive contents, or private Trip details.

## 7. Technical migration principles

### 7.1 Rename the product, not the infrastructure

Phase 1 explicitly does **not** rename:

- GitHub repositories, including `preston-run`, `dose-and-scale`, `mnwistateparks`, and `archive`;
- Railway projects/services;
- production domains or existing route paths;
- environment variables;
- database tables/columns;
- cookie names;
- localStorage/sessionStorage keys;
- object-storage buckets;
- internal IDs;
- API endpoints/contracts;
- historical archive IDs or Trip IDs.

This avoids needless deployment, authentication, persistence, and integration risk.

### 7.2 Visible surfaces that do change

The migration should update, where applicable:

- page titles;
- browser metadata;
- login copy;
- header/brand lockups;
- footers;
- PWA manifest names/short names;
- install prompts where controlled by the app;
- favicon/app-icon references if product-specific assets are introduced;
- cross-product navigation labels;
- current release documentation;
- current accessibility labels and image alt text;
- tests that intentionally assert visible product names.

### 7.3 Compatibility identifiers stay stable

Strings such as existing cookie/storage namespaces that include legacy names are compatibility identifiers, not user-facing branding. They should remain stable unless a separate migration is designed and tested.

For example, a cookie such as `dose_scale_session` should not be renamed merely because the UI becomes Form.

## 8. Metadata and PWA behavior

Each product should expose consistent metadata:

- preston.ai: title `preston.ai` (page-specific templates may append section names).
- Atlas: title `Atlas`.
- Form: title `Form`.
- Archive: title `Archive`.

Where installed as a PWA, app manifests should use the product name visible to the user while preserving existing technical start URLs and scope unless a functional change is required.

App icons should belong to one visual family. Reusing a Preston family mark with a small product-specific symbol/accent is preferred over four unrelated logos.

## 9. Cross-product navigation

### 9.1 Authenticated Preston navigation

The target authenticated navigation is:

`Home · Atlas · Form · Archive`

The current product should have a clear selected state.

Links may cross domains/services. Cross-product navigation should therefore use configured canonical URLs rather than assuming every product shares one host or route prefix.

### 9.2 Public Atlas navigation

Public Atlas pages should prioritize Atlas content. A minimal Preston family identifier/link is acceptable, but private product destinations should not imply that their data is public.

### 9.3 Mobile/PWA behavior

Navigation must remain usable on narrow mobile widths and in installed PWA contexts. The rebrand should not introduce a desktop-only family header.

## 10. Release/version strategy

Each repository keeps its own version line. This rebrand does not synchronize all project semantic versions.

The rollout should occur only after preston.ai v0.14.0 release gates are complete, because v0.14.0 already touches travel presentation and Trip UI and should not absorb unrelated naming churn.

Recommended deployment order:

1. preston.ai family/navigation support;
2. Form rename;
3. Atlas rename;
4. Archive family treatment;
5. final cross-product link verification.

A short period where one product still displays its old name is acceptable during staged deployment, provided links continue to work.

## 11. Non-goals

This rebrand does not:

- merge the four repositories;
- merge the four data models;
- move all products onto one domain;
- rename Railway resources;
- rename GitHub repositories;
- redesign authentication architecture;
- migrate legacy persistence namespaces solely for cosmetic consistency;
- make private data public;
- redesign every product from scratch;
- require real-time data sharing between Atlas, Form, Archive, and preston.ai;
- remove Parks as a feature/category inside Atlas.

## 12. Acceptance criteria

The rebrand is complete when:

1. preston.ai is clearly presented as the umbrella intelligence/orchestration platform.
2. The authenticated family navigation reads `Home · Atlas · Form · Archive`.
3. No current user-facing Form screen identifies the current product as Dose & Scale, except deliberate historical references.
4. No current user-facing Atlas screen uses Parks as the overall product name, while park-specific labels remain correct.
5. Archive remains named Archive and adopts the shared family treatment where appropriate.
6. Browser metadata/PWA names match the new visible product names.
7. Existing repositories, URLs, routes, cookies, storage keys, database identifiers, and integrations continue functioning without migration solely for branding.
8. Public Atlas pages remain public as designed and do not leak private Preston information.
9. Existing automated test suites pass in all affected repositories.
10. Manual smoke testing confirms cross-product navigation on desktop, mobile browser, and installed-PWA contexts where applicable.

## 13. Future naming rule

Future top-level Preston products should prefer short, durable nouns that describe a domain rather than implementation details. New names should fit naturally beside:

`Atlas · Form · Archive`

Functional words such as `Parks`, `Training`, `Stories`, or `Trips` should usually be reserved for sections inside those products unless the section itself becomes a genuinely independent product.
