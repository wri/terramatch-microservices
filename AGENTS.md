# Coding Guidelines for TerraMatch

## About this document

This document is a synthesis of ~2,466 of Nathan Curtis's (`roguenet`, tech lead) real GitHub code-review comments across the three TerraMatch repositories — `wri-terramatch-website` (Next.js/React/TypeScript frontend), `terramatch-microservices` (NestJS/TypeScript backend, Sequelize, the **active** backend), and `wri-terramatch-api` (the legacy PHP/Laravel monolith, being deprecated) — spanning 2023-09 through 2026-09. It is intended as standing instructions for AI coding agents writing or modifying TerraMatch code, so that the code they produce reads the way Nathan would write and review it.

This version has been through an **adversarial verification pass** (completed 2026-09-15): every cited quote was checked against the raw corpus, permalinks were re-resolved, frequency claims were re-counted, and the raw comments were independently re-scanned for high-frequency themes the synthesis missed. Every rule below traces to Nathan's actual words; quotes are verbatim and link to the source PR comment. Frequencies are approximate aggregate counts across the analyzed corpus, not exact totals, and convey relative emphasis, not precision — where a headline number is a sum across several sub-rules, that is stated. Config-file "Tooling" notes are corroboration only — no rule here is invented from config; every rule is grounded in something Nathan actually said.

> **Verification note (2026-09-15).** No fabricated quotes were found: all cited quotes exist verbatim in the corpus. Seven permalinks pointed at the wrong (usually adjacent) comment and were corrected. Several frequency headline numbers were trimmed and one (JSON:API) is now labelled as a section aggregate. A handful of rules whose evidence was a "🎨 / you can leave as-is" style nit were re-labelled as preferences rather than hard rules. Five quote-backed gaps were added (admin-only `t()` exemption, optional-callback `?.()`, the REPL `batchFindAll` convention, the legacy `?->` null discipline, and one-off-script calibration), and three legacy bullets were given their missing citations. Two suspected additions were checked and rejected: there is no corpus support for a non-null-assertion carve-out in spec files, and no basis for a dedicated Testing section (test comments are PR-status reminders, not code-style guidance).

Where a rule is legacy-monolith-specific (Laravel/Eloquent mechanics that don't exist in the TypeScript codebases), it is flagged `Applies to: legacy-api` and, where relevant, cross-referenced to the general principle it transfers into for the active repos. The "Legacy monolith" section near the end collects api-only mechanics separately so agents working in `website` or `microservices` aren't misled into applying PHP-specific tooling `Applies to: both` means `wri-terramatch-website` and `terramatch-microservices`..

---

## Precedence and scope

1. Explicit instruction from the user or the ticket.
2. Tooling: `tsc`, ESLint, Prettier — never hand-format against them.
3. This guide, applied only to lines you add or modify. Don't refactor untouched code to conform; report it as a follow-up.
4. The nearest existing implementation in the same area.

If this guide contradicts the code you can see, trust the code and flag the discrepancy.

## Top principles (read this if nothing else)

These are Nathan's highest-frequency, most mechanically-enforced rules — the ones he repeats almost verbatim across hundreds of PRs, in all three repos:

1. **Explicit `== null` / `!= null` checks, never implicit truthiness** (`!x`, `if (x)`, `!!x`, `x ? a : b` as a null test). By far the single most-repeated correction in the entire corpus (~205 instances). He wants both `null` and `undefined` caught in one check, deliberately using loose equality.
2. **`??` (nullish coalescing) for defaults — never `||`.** Reserve `||` for genuine boolean expressions. (~150+ instances.)
3. **No `any`, no unnecessary `as`/`!`/`@ts-ignore`.** Type with the real DTO/model; use `@ts-expect-error` with a comment only when truly necessary. (~110+ instances.)
4. **No N+1 queries; query efficiency is not optional.** Batch-load associations, limit `attributes`/`select` to what's used, push aggregation into SQL. He explicitly names this "one of the main reasons the terramatch BE is so slow." (~80+ instances.)
5. **Ruthless simplification and zero dead code.** Delete unused code, superfluous variables, commented-out blocks, debug logs, and mock data before merge; collapse redundant branches into the simplest correct expression. (~250+ instances aggregated across many sub-rules — this is the connective tissue of nearly every review.)
6. **Every v3 endpoint is a JSON:API resource, never an RPC action.** Plural camelCase nouns, `buildJsonApi()`/`@JsonApiResponse`, UUIDs not integer IDs, one DTO per resource type. (~30–45 instances for the core resource/RPC rule itself; ~190 aggregated across the whole API Design & JSON:API Contract section below.)
7. **Authorization is permission-based, via policies, on every endpoint — never role checks, never ad hoc.** (~40+ instances.)
8. **Never `console.*` — always the shared logger utility (`Log`/`TMLogger`).** (~50+ instances.)
9. **Wrap every user-facing string in `t()`** (website only — Transifex i18n; components used only in Admin/react-admin flows are exempt). (~85 instances.)
10. **Follow the established pattern already in the codebase** rather than inventing a parallel one — he points to a reference implementation in nearly every structural comment.

---

## TypeScript & Typing

### Never use `any`

**Do:** type with the real DTO, model, or a narrow local interface — even for loosely-shaped JSON, prefer `object` plus a local cast. **Don't:** reach for `any` or `eslint-disable no-explicit-any` as a first resort.
`any` defeats the entire purpose of the TypeScript migration; he calls it out even in throwaway code and always asks "why is this `any` here?" before accepting it.

- Evidence: "We try very hard to avoid `any` in this codebase." — https://github.com/wri/terramatch-microservices/pull/31#discussion_r1890583132
- Evidence: "I think it should be possible to avoid these `any`s (all throughout this file). Anything related to v3 should be strongly typed." — https://github.com/wri/wri-terramatch-website/pull/1460#discussion_r2364521299
- Applies to: both
- Frequency: ~60

### Don't add type noise: unnecessary `as`, `!`, `| undefined`, or explicit annotations TS can infer

**Do:** let inference and the DTO/model definitions do the work. **Don't:** cast a value already of that type, assert non-null (`!`) where a guarantee already exists, or double-declare `?:` and `| undefined`.
Redundant type assertions and annotations are noise that can silently drift out of sync with reality; if the compiler can already prove it, restating it just adds a place for the two to disagree.

- Evidence: "This `as` typing should not be needed - the store is very thoroughly typed." — https://github.com/wri/wri-terramatch-website/pull/1198#discussion_r2085171270
- Evidence: "This `as` should be unnecessary… it just seems to be declaring the same type the compiler should be able to get from the statement." — https://github.com/wri/terramatch-microservices/pull/494#discussion_r2729760828
- Applies to: both
- Frequency: ~55
- Tooling: microservices `eslint.config.mjs` enables `@typescript-eslint/strict-boolean-expressions` (disallows nullable string/number/object in boolean position) — directly corroborates both this and the null-check rule below.

### Use `@ts-expect-error` with an explanatory comment; never a bare `@ts-ignore`

**Do:** suppress only when genuinely necessary, using `@ts-expect-error` (which fails loudly once the underlying error is fixed) plus a comment explaining why. **Don't:** stack suppressions or leave one in without justification.
A bare `@ts-ignore` can silently mask a real, unrelated error forever; `@ts-expect-error` self-destructs when it's no longer needed.

- Evidence: "Why is this needed? If it is necessary, please use `// @ts-expect-error` with an explanation." — https://github.com/wri/wri-terramatch-website/pull/1141#discussion_r2066980767
- Evidence: "Thank you for the comment - however, please use `@ts-expect-error` instead." — https://github.com/wri/wri-terramatch-website/pull/1749#discussion_r2729115235
- Applies to: both
- Frequency: ~10

### Trust validated/typed data — don't add defensive runtime guards after the type system or DTO validation already proves it

**Do:** rely on class-validator decorators, non-nullable columns, and TS's own guarantees. **Don't:** re-check `typeof`, `Array.isArray`, or `!== undefined && !== null` on a value the compiler and DTO validation already constrain.
Once a value has passed through a validated DTO and is typed, re-checking it is dead code that only obscures what's actually being tested.

- Evidence: "Between the DTO validation that happens under the hood and the typescript compiler, we should have reasonable confidence that landscapes is already a string array. I think all the checks and safeguards above this line should be removed." — https://github.com/wri/terramatch-microservices/pull/157#discussion_r2102926596
- Evidence: "Given that the `uuid` column is not nullable, is this check really necessary? The DB can be depended on to fill this in." — https://github.com/wri/terramatch-microservices/pull/511#discussion_r2739228017
- Applies to: microservices (mirrored on website by the "honor method contracts" rule below)
- Frequency: ~30

### Nullable fields are typed `| null`, never optional `?:` — with the opposite convention for request DTOs

**Do:** on entities and response DTOs, use `field: T | null` with `@AllowNull` (entity) or `nullable: true` + explicit `type:` (`@ApiProperty`). On **request** DTOs, prefer `field?: T` (`required: false`) so the generated FE client accepts `undefined`, not `null`.
Nathan discovered this asymmetry is what makes FE typing pleasant: response shapes should be honest about "this can be null," while request shapes should let callers simply omit a field.

- Evidence: "In requests, please use `required: false` instead of `nullable: true`... My current connection work has uncovered that this is friendlier for FE typing." — https://github.com/wri/terramatch-microservices/pull/201#discussion_r2179047659
- Evidence: "The convention with nullable columns in entities has been to use `: string | null`." — https://github.com/wri/terramatch-microservices/pull/195#discussion_r2136645911
- Applies to: microservices
- Frequency: ~20

### A "full" DTO/type is always a strict superset of its "light" counterpart — model it with `extends`, never a parallel union

**Do:** have `FullDto extends LightDto`, and design `findOne` includes as a strict superset of `findMany` includes. **Don't:** create `XDtoV2`, an unrelated union of possible shapes, or duplicate a DTO definition per service.
The FE connection cache depends on being able to assume every declared field is populated regardless of which endpoint produced the object — breaking the superset relationship breaks caching silently.

- Evidence: "remember that the full DTO extends from the light DTO, and the client is depending on the full always being a strict superset of the light." — https://github.com/wri/terramatch-microservices/pull/137#discussion_r2051245608
- Evidence: "There should not be duplicate definitions of a given resource. If a DTO is needed in more than one service, move it to common and use it in both." — https://github.com/wri/terramatch-microservices/pull/157#discussion_r2102896567
- Applies to: microservices
- Frequency: ~15

### Give each concept its own type — don't widen or reuse a type that belongs to a different model

**Do:** define a new type/DTO/query-params class per distinct model, even if it looks similar to an existing one. **Don't:** stretch an existing union (e.g. add Disturbances to a `DemographicEntity` union) or reuse another resource's query params.
Reusing a type across unrelated models is how a change to one silently breaks the other.

- Evidence: "This should get its own type. Demographics and Disturbances are different models and can be attached to different entities." — https://github.com/wri/wri-terramatch-website/pull/1167#discussion_r2066926208
- Applies to: website
- Frequency: ~6

### Derive types from their source (`typeof`, generics, `ModelCtor<M>`) instead of hand-writing a parallel definition

**Do:** reference the real function/hook/model type so future signature changes propagate automatically; make a method generic over the models it handles rather than branching per type. **Don't:** redefine a signature in a comment or duplicate a type by hand.

- Evidence: "I think it's better to get the type from the library than to redefine it ourselves in case it changes in a future version." — https://github.com/wri/wri-terramatch-website/pull/1880#discussion_r2860651856
- Evidence: "Your TS errors will probably go away and the code will be cleaner … if you make this method generic" — https://github.com/wri/terramatch-microservices/pull/463#discussion_r2641605272
- Applies to: both
- Frequency: ~12

### Type finite value sets as `as const` arrays with a derived type, and reuse that type in DTO `enum:` and model columns

**Do:** define a limited set of valid values once, derive `(typeof X)[number]`, and use it everywhere that value flows (DTO validation, Swagger `enum`, entity column type). **Don't:** leave such fields as bare `string`.

- Evidence: "Since there are a limited number of valid criteria IDs, this member should be typed more specifically ... providing both a set of valid values and a type" — https://github.com/wri/terramatch-microservices/pull/311#discussion_r2377016674
- Applies to: microservices
- Frequency: ~8

### `as <type>` is for settling something only you (not the compiler) can know — never to paper over a genuinely optional value

**Do:** cast only when surrounding logic guarantees a value's type more precisely than TS can see (e.g. after a `geotagged` check). **Don't:** cast a field to a required type when it's actually sometimes absent — make it optional and handle `undefined` instead.

- Evidence: "The `as <type>` TS hint is only really meant to be used when you as the developer know that the type is settled, but TS doesn't have any way to know. Any other usage could easily end in runtime errors." — https://github.com/wri/terramatch-microservices/pull/464#discussion_r2666483115
- Applies to: microservices
- Frequency: ~4

### New Sequelize entities use the inferred-attributes generic form

**Do:** declare `Model<InferAttributes<T>, InferCreationAttributes<T>>` and mark defaulted columns `CreationOptional`. **Don't:** redeclare `createdAt`/`updatedAt` — Sequelize provides them; cast at the use site (`as Date`) if a non-null copy is needed.

- Evidence: "we've been transitioning to using `Model<InferAttributes<OrganisationInvite>, InferCreationAttributes<OrganisationInvite>>` … It makes the semantics around creation a bit better typed." — https://github.com/wri/terramatch-microservices/pull/585#discussion_r2866594253
- Applies to: microservices
- Frequency: ~6

### Mutate `status` only through `@StateMachineColumn` and the shared slug constants

**Do:** use `ENTITY_STATUSES` / `REPORT_STATUSES` / `POLYGON_STATUSES` (`draft`, `pending-approval`, `information-required`, `approved`; reports also have `due`). Assigning `model.status = next` is valid **only** because `@StateMachineColumn` runs `transitionTo` and throws `StateMachineException` (HTTP 400) on an illegal transition. **Don't:** invent a new slug, write PHP-era values (`awaiting-approval`, `restoration-in-progress`), or treat disturbance reports as having `due`.
v3 already has the Laravel state-machine equivalent in `libs/database/src/lib/util/model-column-state-machine.ts`. The legacy section that says “no direct v3 equivalent yet documented” is out of date and should be replaced with this rule.

- Evidence: status slug alignment — https://github.com/wri/terramatch-microservices/pull/909 , https://github.com/wri/terramatch-microservices/pull/919 ; disturbance reports do not use `due` — https://github.com/wri/terramatch-microservices/pull/883 ; removed restoration-in-progress — https://github.com/wri/terramatch-microservices/pull/359
- Applies to: microservices
- Priority: mandatory

---

## Null-Handling & Defensive-Code Style

### Use explicit `== null` / `!= null` checks — never implicit truthiness

**Do:** write `x == null` / `x != null` (loose equality, deliberately, so both `null` and `undefined` are caught in one expression). **Don't:** use `if (!x)`, `if (x)`, `!!x`, `x ? a : b` as a null test, `!== undefined && !== null`, or `.filter(Boolean)`.
This is Nathan's single most emphatic rule, applied identically across all three repos: "It's always safer to catch both null and undefined since it's so easy for one to sneak in where you expect the other." When the real condition isn't nullability (an empty string, a positive number), he wants that condition written explicitly instead (`.length === 0`, `> 0`) so a reader doesn't have to consult the type to know what's being tested.

- Evidence: "Implicit boolean checks in JS / TS are an anti pattern in my opinion. Much prefer explicit null or value checks." — https://github.com/wri/terramatch-microservices/pull/64#discussion_r1987692267
- Evidence: "Please always use double equals for null comparison. It's always safer to catch both null and undefined since it's so easy for one to sneak in where you expect the other (`!= null` instead of `!== null`)." — https://github.com/wri/wri-terramatch-website/pull/1198#discussion_r2088039657
- Evidence: "This is a prime example of why I want explicit null checks over implicit boolean coercion. Because of this coercion, I had to go look at the defined props type to see if this could be null." — https://github.com/wri/wri-terramatch-website/pull/1786#discussion_r2734210079
- Evidence (legacy-api, same discipline in PHP): "`uuid` is guaranteed not to be null based on the `first()` above, so this can simply be `if ($firstRecord == null) { return null; }`" — https://github.com/wri/wri-terramatch-api/pull/1021#discussion_r2322961481
- Applies to: both (also appears throughout legacy-api as `?->` / explicit `== null` / early-return discipline — see the Legacy monolith section)
- Frequency: ~230+ (the dominant rule in the corpus)
- Tooling: microservices `eslint.config.mjs` — `@typescript-eslint/strict-boolean-expressions` with `allowString: false, allowNumber: false, allowNullableObject: false` partially enforces this in microservices: it allows nullable booleans (`allowNullableBoolean: true`) and doesn't catch `.filter(Boolean)`. The website has no equivalent rule..

### Use `??` for defaults — reserve `||` for genuine boolean expressions

**Do:** write `x ?? "default"` for any fallback value, including inside template strings and destructured defaults; use `??=` for lazy-init. **Don't:** use `||` (it silently swallows legitimate falsy values like `0`/`""`) or a `cond ? cond : default` ternary. The one exception: when both operands are actually booleans, `||` is correct and `??` is wrong.

- Evidence: "Please use `??` for assigning default values." — https://github.com/wri/wri-terramatch-website/pull/173#discussion_r1605348977
- Evidence: "Since this is an actual boolean expression, use `||` here." — https://github.com/wri/wri-terramatch-website/pull/1460#discussion_r2370672021
- Applies to: both
- Frequency: ~150+

### Avoid boolean/string coercion of null (`!!x`, `Boolean(x)`, `String(x)`) — supply a typed default or use `isEmpty`

**Do:** provide an explicit default of the right type (`?? ""`, `?? 0`), or reach for lodash `isEmpty` when "null or empty string" is really the intent. **Don't:** wrap an already-boolean value in `Boolean()`, or coerce null to a string (`String(null)` becomes the literal text `"null"`).

- Evidence: "When dealing with nulls, it's usually better to provide a default instead of coercion (especially in the case of strings because `String(null)` comes out as `\"null\"`" — https://github.com/wri/wri-terramatch-website/pull/1226#discussion_r2103096326
- Evidence (🎨 style nit, not blocking): "🎨 ... No need to wrap the expression in `Boolean`." / "`valid` is already a boolean." — https://github.com/wri/terramatch-microservices/pull/311#discussion_r2377055814
- Applies to: both
- Frequency: ~25

### Trust framework/DB guarantees — don't re-guard what a non-null column, an earlier check, or a `required` join already ensures

**Do:** use a narrowing cast (`as number`) once a guard (auth middleware, `@ArrayMinSize`, a non-nullable column, a `required: true` include) has already run. **Don't:** validate the same thing twice across controller and service, or add `?.` where a join guarantees presence.

- Evidence: "This check is not needed; it is performed before your controller method is even called. You should be able to use this instead: `const userId = this.policyService.userId as number;`" — https://github.com/wri/terramatch-microservices/pull/445#discussion_r2612893419
- Evidence (🎨 "you can leave as-is" — a suggestion, not a blocker): "🎨 You can leave as-is, but I'm pretty sure this `?` isn't needed because site gets an 'required' inner join" — https://github.com/wri/terramatch-microservices/pull/75#discussion_r1987678124
- Applies to: both
- Frequency: ~40

### Be consistent about a value's nullability within one scope

**Do:** decide whether a given object can be null in a given code path and apply `?.` (or don't) uniformly to every access of it. **Don't:** mix `item.x` and `item?.y` for the same object in one mapping.

- Evidence: "There's some inconsistency around accessing `item` in this mapping. Can it be null? If so, please use `item?.` everywhere. If it can't, please use `item.` everywhere." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625052003
- Applies to: website
- Frequency: ~5

### Honor method/function contracts — don't loosen a non-null signature with `?.`; find who is actually passing null

**Do:** trace a runtime null back to its source and fix the caller. **Don't:** silence the symptom by adding optional chaining to a function whose contract promises non-null input.

- Evidence: "Why this change? The method contract calls for non null files, so this shouldn't be here. If you're seeing a runtime error, please look to find out who's sending null files into this method." — https://github.com/wri/wri-terramatch-website/pull/2058#discussion_r2933565728
- Applies to: website
- Frequency: ~5

### Invoke an optional callback with safe navigation (`fn?.()`), not a boolean guard

**Do:** call an optional callback as `refresh?.()`. **Don't:** write `cond && fn()` or `if (fn) fn()` for the same purpose. If the prop is declared required, drop the `?.` entirely — it's then noise (see "Trust framework/DB guarantees").

- Evidence: "Please use safe navigation instead of boolean expression: `refresh?.();`" — https://github.com/wri/wri-terramatch-website/pull/250#discussion_r1635495641
- Evidence: "These two can use safe navigation `refresh?.(); reloadEntity?.();`" — https://github.com/wri/wri-terramatch-website/pull/248#discussion_r1633645295
- Applies to: website
- Frequency: ~6

---

## Naming & Readability

### Names must say exactly what the thing is — no copy-paste inheritance, no generic placeholders

**Do:** rename variables/functions/components to reflect their actual contents and purpose (`user` not `userDto` holding a `User`; `projectsBuilder` not `projects` holding a query builder). **Don't:** let a name survive a refactor that changed what it holds, or ship a component/hook name copied from a similar but different file.

- Evidence: "I would rename this to `user` to accurately reflect what the variable holds." — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2046070804
- Evidence: "`updateSiteStatus` is _way_ too generic; it could mean so many things." — https://github.com/wri/wri-terramatch-api/pull/324#discussion_r1663092058
- Applies to: both, legacy-api
- Frequency: ~45

### camelCase everywhere in TypeScript; ALL_CAPS reserved for true module-level constants; DB stays snake_case, mapped explicitly

**Do:** camelCase for locals, functions, and entity/DTO attributes (even snake_case DB columns get `@Column({ field: "snake_case" })`); `SCREAMING_SNAKE_CASE` only for constants that are genuinely fixed data; PascalCase for classes/components/types; lowercase-first for exported functions (uppercase-first is reserved for classes). **Don't:** let snake_case leak into TS identifiers or a variable start with a capital.

- Evidence: "We're pretty consistent about using camelCase in the FE codebase, except when accessing API response members that happen to be snake_case." — https://github.com/wri/wri-terramatch-website/pull/416#discussion_r1707460832
- Evidence: "local variables should not start with a capital, and should cap each individual word" — https://github.com/wri/terramatch-microservices/pull/411#discussion_r2560975414
- Applies to: both
- Frequency: ~30

### Fix spelling and typos in code you touch— identifiers, file names, comments, and user-facing strings

**Do:** correct typos in lines you add or modify, and at the data source when it's part of the same data flow (otherwise report it as a follow-up), and rename files to match corrected/renamed exports. **Don't:** let a misspelled constant, prop, or filename persist because "it still works."

- Evidence: "`Unknown` is misspelled. Please correct here and if it's possible for the `statusLabel` being passed in to have the bad spelling, correct the source too." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1624997919
- Applies to: both, legacy-api
- Frequency: ~35

### Hoist magic numbers and literal value sets to named constants at module scope

**Do:** define `const PAGE_SIZE = 20` (or `SCREAMING_SNAKE_CASE` with `as const` for arrays/objects) once, outside any function or class, and reference it everywhere. **Don't:** repeat an inline literal ID, array, or regex, or rebuild a lookup map inside a function on every call — hoist it to a file-level map and index into it.

- Evidence: "What's the purpose of this magic number?" — https://github.com/wri/wri-terramatch-api/pull/145#discussion_r1566527022
- Evidence: "Please define this map as a const at the file level, instead of within the function." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625035380
- Applies to: both, legacy-api
- Frequency: ~30

### Booleans must read as booleans; get-or-throw helpers are named `requireX`

**Do:** name a boolean-valued field/expression so its truth value is obvious (`isFormMap`, `canLogIn: user.password != null`) and name a helper that fetches-or-throws with a `require` prefix. **Don't:** leave an ambiguous name that forces a reader to check the type to know if a value is boolean.

- Evidence: "Is `formMap` a boolean? ... I would either rename it to be clearly boolean (`isFormMap` maybe), or this needs a null check." — https://github.com/wri/wri-terramatch-website/pull/2320#discussion_r3190214221
- Evidence (🎨 preference for the `require` naming — not blocking): "🎨 I like \"require\" as a name for methods like this (`requirePlot`)" — https://github.com/wri/terramatch-microservices/pull/635#discussion_r2990299184
- Applies to: both
- Frequency: ~10

### Keep enumerated lists and imports alphabetized

**Do:** keep constant lists, barrel `index.ts` exports, and multi-value arrays alphabetical. **Don't:** insert a new entry out of order, or reorder an unrelated list as a drive-by change in a feature PR.

- Evidence: "Let's keep this list alphabetical, just for my own sanity :)" — https://github.com/wri/terramatch-microservices/pull/290#discussion_r2363994836
- Applies to: both
- Frequency: ~8
- Tooling: website `.eslintrc.js` enables `simple-import-sort/imports: "error"`.

---

## Simplicity / Dead-Code / DRY

### Remove all dead code before merge — no exceptions

**Do:** delete unused variables/params/props/methods/files, commented-out code, debug logging, mock/placeholder data, and stale TODOs before requesting review. **Don't:** leave anything "just in case" — if it isn't used in this PR, it doesn't belong in it (the one narrow exception he allows himself: temporary dual-path code he's already scheduled to remove in the very next ticket, explicitly commented as such).
This is the most frequently repeated hygiene rule after null-checks; he flags it with a bare 🛅 emoji as often as with words.

- Evidence: "it's completely unused. Are there plans to use it in the future, or is this dead code? If it's dead, I think we should go ahead and remove it in this PR." — https://github.com/wri/wri-terramatch-website/pull/900#discussion_r1945950339
- Evidence: "Please don't leave in commented out code." — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925824269
- Evidence: "Can we get rid of the mocked data before this goes into `staging`?" — https://github.com/wri/wri-terramatch-website/pull/248#discussion_r1633657960
- Applies to: both, legacy-api
- Frequency: ~220+ (aggregated across dead-code / commented-code / mock-data / debug-log sub-cases)

### Eliminate superfluous intermediate variables and wrapper functions

**Do:** return or inline an expression directly when a variable is assigned once and immediately used; pass a function reference directly instead of wrapping it in a new arrow that does nothing but call it. **Don't:** stash a value in a variable "for clarity" when it adds no clarity, or add a factory/wrapper around a value that could be used as-is.

- Evidence: "The `result` variable is superfluous - simply return on line 45." — https://github.com/wri/wri-terramatch-website/pull/263#discussion_r1647879543
- Evidence: "There's no reason to assign to a variable just to turn around and return it (my IDE would even give a soft warning on this line because of it)." — https://github.com/wri/wri-terramatch-website/pull/1264#discussion_r2138597203
- Applies to: both, legacy-api
- Frequency: ~55

### Prefer the concise, expression-bodied form for single-statement functions and components

**Do:** write `() => x` (or `() => (<JSX/>)`) instead of a block with an explicit `return`, to reduce indentation. **Don't:** wrap a single-expression arrow body in braces and a `return` statement.
**Status — softened over time.** Nathan enforced this as a flat imperative through roughly 2024–2025 ("please remove the `return`"). By early 2026 he reframes it as an explicitly non-blocking preference: "🎨 I prefer arrow functions, but I don't insist on it" and "🎨 you may leave as is." Treat it as a style preference that a reviewer may raise but will not block on — not a hard rule.

- Evidence (early, firm): "Avoid return statement for single-statement arrow functions" — https://github.com/wri/wri-terramatch-website/pull/253#discussion_r1637115421
- Evidence (early, firm): "Simple arrow functions with a single return statement should typically avoid the return to reduce indentation level" — https://github.com/wri/wri-terramatch-website/pull/249#discussion_r1636970783
- Evidence (later, softened): "🎨 I would use an arrow function here as well... I prefer arrow functions, but I don't insist on it." — https://github.com/wri/wri-terramatch-website/pull/1851#discussion_r2784199277
- Applies to: website
- Frequency: ~20

### Collapse redundant branches and conditions into the simplest equivalent expression

**Do:** merge sequential `if` guards that test related conditions, replace `if (x) set(true) else set(false)` with `set(x)`, drop conditions a preceding check already guarantees (`Array.isArray` already null-checks), and combine near-duplicate branches into one with a parameter. **Don't:** leave two checks doing the work of one, or scan a list twice when a length comparison suffices.

- Evidence: "It's a little weird to have two `if` blocks here. Simply combine to `if (!menuContainerRef.current || !menuRef.current)` please." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625050819 (2024 example; per the null-check rule, write `menuContainerRef.current == null || menuRef.current == null`)
- Evidence: "These two checks can be combined into `providedParams.length !== 1`" — https://github.com/wri/terramatch-microservices/pull/443#discussion_r2612868959
- Applies to: both, legacy-api
- Frequency: ~60

### Don't build what isn't needed yet (YAGNI) — scope strictly to the ticket and real consumer need

**Do:** cut unused options, speculative generalizations, and filters nothing calls; add them in a dedicated future ticket if and when they're needed. **Don't:** add a DTO field, endpoint, or config knob because "we might want it later," and don't smuggle unrelated changes into a PR.

- Evidence: "It looks like nothing is using this due after / before option currently. Unless you know you're going to need it, let's not add it for now." — https://github.com/wri/terramatch-microservices/pull/157#discussion_r2088067723
- Evidence: "this change doesn't seem to have anything to do with this ticket." — https://github.com/wri/wri-terramatch-website/pull/1167#discussion_r2066925029
- Applies to: both
- Frequency: ~25

### Consolidate duplicated logic into one shared implementation

**Do:** extract a shared hook/utility/component/service method the moment the same code (or the same review comments) appear in more than one place. **Don't:** copy-paste a component/method and diverge, or maintain two near-identical services/controllers/endpoints.

- Evidence: "I'm seeing a _lot_ of duplication in these modal components, simply through having to leave the same comments on many files; which tells me there's probably a lot of copy/paste going on here." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625097139
- Evidence: "Lots of duplication in this class" — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2046096368
- Applies to: both, legacy-api
- Frequency: ~35

### Reach for lodash and existing repo utilities before hand-rolling

**Do:** use `isEmpty`, `isString`, `isNumber`, `sumBy`, `uniq`, `groupBy`, `startCase`, `camelCase`/`snakeCase`, and existing repo helpers (`isNotNull` in both repos, `getProjectId` in microservices) instead of writing a loop, regex, or type check by hand. For edge-case-heavy domains (date parsing/arithmetic), use the library the repo already has (`date-fns` in the website, `luxon` in microservices) rather than hand-rolling; don't add new date libraries.
.

- Evidence: "I try very hard to avoid `any`... Any time I see `create` in a loop, I want to move it to a bulk create" (general pattern of reaching for the library helper) — see query-efficiency section; direct lodash quote: "This can just be done with lodash: `return startCase(str)`" — https://github.com/wri/wri-terramatch-website/pull/1818#discussion_r2755670759
- Evidence: "have we considered bringing in a library to handle date parsing and display? Luxon for instance is very powerful, and date parsing/display is fraught enough that it's really easy to miss edge cases." — https://github.com/wri/wri-terramatch-website/pull/27#discussion_r1466739133
- Applies to: both
- Frequency: ~35

---

## Architecture & Code Placement

### Move context-free functions and constants out of the component/class body to module scope

**Do:** define any function or constant that doesn't close over component props/state/hooks (or class `this`) at module level. **Don't:** leave a pure helper nested inside a component or method, where it gets recreated every call — a tell is a `useCallback` with an empty dependency array.

- Evidence: "This function doesn't appear to depend on any props to the component - please move out of the component definition for clarity and performance." — https://github.com/wri/wri-terramatch-website/pull/263#discussion_r1647880380
- Evidence: "There doesn't seem to be any reason to define this method within the surrounding method. Please move to the top of the file above the class definition." — https://github.com/wri/terramatch-microservices/pull/224#discussion_r2183821631
- Applies to: both
- Frequency: ~35

### Keep base/abstract classes generic — subclass-specific logic lives in the subclass

**Do:** give a base processor/class a sensible generic default (e.g. return an empty map) and let subclasses override the specific hook. **Don't:** add `instanceof`-per-subclass branches, a hardcoded `allowedTypes` list, or any subclass-aware special case inside a superclass.

- Evidence: "I definitely don't want to see custom code specific to one type of association DTO in the processor super class. Anything custom like this should be handled in the custom subclass." — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2046077278
- Evidence: "The processor superclass should not care about (or have custom logic for) when this subclass method is called." — https://github.com/wri/terramatch-microservices/pull/333#discussion_r2429761877
- Applies to: microservices
- Frequency: ~15

### Extend systems generically — never special-case behavior on an entity type, string key, or linked-field key

**Do:** add a new input type, context value, or additional-props field when a form/shared system needs new behavior. **Don't:** branch a shared system (`FormStep`, `FieldMapper`, react-admin record representation, form rendering) on `entity === "disturbance-reports"` or a specific `linked_field_key` — Nathan has traced hard-to-find bugs to exactly this pattern.

- Evidence: "It should definitely not be necessary to customize `FormStep` for one specific report type, and is not in keeping with the spirit of this system. Things like this are a code smell for sure and will result in weird bugs sneaking out." — https://github.com/wri/wri-terramatch-website/pull/1391#discussion_r2345426950
- Evidence: "The FE should really _never_ be customizing something based on linked field key... All customization of form questions should be handled in additional props" — https://github.com/wri/wri-terramatch-website/pull/2220#discussion_r3087470501
- Applies to: website
- Frequency: ~10

### One implementation per behavior — unify near-duplicate services, controllers, and endpoints

**Do:** merge two methods/controllers/endpoints that differ only by a flag or a scope parameter into one, generalized appropriately (e.g. `:model` route param). **Don't:** maintain parallel admin/non-admin controllers, separate near-identical endpoints, or two services doing the same job — gate behavior with policies/permissions instead of forking code paths.

- Evidence: "We do not have separate controllers for admins in v3. Please refactor to move this functionality into the users controller. Access control should be handled through policies." — https://github.com/wri/terramatch-microservices/pull/605#discussion_r2909284497
- Evidence: "This method is _very_ similar to the project one. I think a better approach for this controller is to change the controller declaration to `@Controller(\"userAssociations/v3/:model\")`" — https://github.com/wri/terramatch-microservices/pull/568#discussion_r2860707180
- Applies to: microservices
- Frequency: ~2- Evidence: "Please move this module to the `common` lib. It will be needed across many apps." — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925840687
- Evidence: "If it's going to be used in PD interfaces, I would move it out of the `src/admin` space to make that clear." — https://github.com/wri/wri-terramatch-website/pull/250#discussion_r1636831847
- Applies to: both0

### No mutable instance state in singleton services or module-level `let`s

**Do:** pass values through method parameters between calls. **Don't:** store per-request state as a field on an `@Injectable` singleton (it leaks across concurrent requests) or as a module-level `let`. Request scope (`Scope.REQUEST`) is a last resort that must be justified.

- Evidence: "local mutable variables are not a great idea in `Injectable` services because they get reused … A better pattern is to pass these around between methods." — https://github.com/wri/terramatch-microservices/pull/463#discussion_r2666516429
- Evidence: "It's very unusual to have `let`s at the module level. These are effectively global - are you absolutely certain that there will never be two active uses of these at the same time?" — https://github.com/wri/wri-terramatch-website/pull/2111#discussion_r2990408108
- Applies to: both
- Frequency: ~10

### Directory location signals ownership — shared code goes in the common lib; a resource's endpoints live in its owning service

**Do:** put anything used by more than one app/service in `libs/common` (or `src/connections` for FE data access); keep all endpoints for a given resource together. **Don't:** split two tiny overlapping services just because they arrived in different tickets, or scatter one resource's API across services.

- Frequency: ~20

### Follow the pattern already established in the codebase — don't invent a parallel mechanism

**Do:** search for and reuse the existing hook/utility/base-class/scope pattern (he routinely links to a specific file as the reference implementation) before writing something new that does the same job differently. **Don't:** hand-roll Redis access, memoization, or an association lookup when an established pattern already exists.

- Evidence: "This is also not following previous patterns in this codebase... See how this pattern is established in `getBaseEntity`" — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2064709610
- Evidence: "This hook should be used in all cases where we want to display the current framework name, instead of redefining it in lots of places." — https://github.com/wri/wri-terramatch-website/pull/379#discussion_r1680024660
- Applies to: both
- Frequency: ~30

### Fail fast: checks that can throw run before expensive or side-effecting work

**Do:** put anything that might throw (404 lookups, validation) at the top of a method, before dispatching costly work (token signing, a service call, a delete cascade); controllers own the 404 check before invoking a service, so the service can assume it has a real record. **Don't:** do a lookup or costly conditional query before confirming it's actually needed.

- Evidence: "I like to have anything that can be checked and might throw an error to happen at the top of the method so additional work isn't done when something fails." — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925830086
- Evidence: "Pulling the site and checking for a 404 should be done before the call to the service to limit the work done." — https://github.com/wri/terramatch-microservices/pull/398#discussion_r2540615556
- Applies to: both, legacy-api
- Frequency: ~15

### Keep controllers thin: serialization, business logic, and validation live in the service/DTO layer

**Do:** let the service normalize cache-return shapes, the entity own its `@JsonColumn` parsing, and DTO decorators own validation. **Don't:** make a controller aware of implementation details ("sometimes a string comes out of the cache") or duplicate service logic inline.

- Evidence: "I think this kind of conversion would better handled in the cache service. The controller shouldn't need to know that sometimes a string comes out of the service." — https://github.com/wri/terramatch-microservices/pull/157#discussion_r2103052551
- Applies to: microservices
- Frequency: ~10

### Respect dependency injection — never manually `new` an injectable service; don't make dependency-free classes injectable

**Do:** let NestJS inject services normally, even inside custom decorators/guards; register dependency-free classes (validators, calculators) in a plain module-level map instead. **Don't:** bypass DI with `new SomeInjectedService()`, which breaks testability and future overrides.

- Evidence: "I don't love that this decorator is creating a normally injected service manually. That's circumventing the normal pattern for NestJS." — https://github.com/wri/terramatch-microservices/pull/233#discussion_r2211370257
- Applies to: microservices
- Frequency: ~6

### New entity / report types go through `EntityProcessor` — never a parallel controller

**Do:** add a subclass of `EntityProcessor<Model, LightDto, FullDto, UpdateDto, CreateDto>` and register it on `ENTITY_PROCESSORS` in `entities.service.ts` (`projects`, `sites`, `nurseries`, `projectReports`, `siteReports`, `nurseryReports`, `financialReports`, `disturbanceReports`, `srpReports`). Implement `findOne` / `findMany` / `getLightDto` / `getFullDto` / `export` / `exportAll`. Type-specific logic lives in the subclass. **Don't:** add a one-off CRUD controller for a new report type, or put `instanceof` / `entity === "disturbance-reports"` branches in the processor superclass.
This is the v3 resource pattern Nathan asks agents to copy. Financial reports, disturbance reports, and SRP reports all landed this way — not as RPC endpoints.

- Evidence: entity index processors — https://github.com/wri/terramatch-microservices/pull/95 , https://github.com/wri/terramatch-microservices/pull/101 , https://github.com/wri/terramatch-microservices/pull/103 , https://github.com/wri/terramatch-microservices/pull/124 ; financial reports to v3 — https://github.com/wri/terramatch-microservices/pull/276 , https://github.com/wri/terramatch-microservices/pull/278 ; disturbance reports — https://github.com/wri/terramatch-microservices/pull/290 , https://github.com/wri/terramatch-microservices/pull/346 , https://github.com/wri/terramatch-microservices/pull/333 ; SRP reports — https://github.com/wri/terramatch-microservices/pull/373 , https://github.com/wri/terramatch-microservices/pull/388
- Applies to: microservices (`entity-service`)
- Priority: mandatory

### Associations (trees, media, disturbances, invasives, stratas, trackings) use `ASSOCIATION_PROCESSORS`

**Do:** attach nested collections through the association processor map (`media`, `treeSpecies`, `disturbances`, `invasives`, `stratas`, `seedings`, `trackings`). Keep polymorphic `*ableId` / `*ableType` queries behind that processor. **Don't:** embed a full related collection on an entity DTO by hand, or invent a second way to load the same association.

- Evidence: invasive collection on tree species — https://github.com/wri/terramatch-microservices/pull/729 ; media collections must use the real collection name (`nursery-seedling`, not a copy-pasted `tree-planted`) — https://github.com/wri/terramatch-microservices/pull/63
- Applies to: microservices
- Priority: mandatory

### Form questions map through `LinkedFieldsConfiguration` — never a controller special case

**Do:** add the field/relation/file collection to the model’s linked-field config in `libs/common/src/lib/linkedFields/` and consume it with `getLinkedFieldConfig`. New form answers, change-request payloads, CSV export headings, and approval-field copies all go through that map. **Don't:** hard-code a `linked_field_key` in a controller/processor, or add a DTO field that the form can write but the config cannot find.
If a financial-report field is missing from the config, it will not show on change requests even when it exists on the DTO.

- Evidence: financial-report linked fields / change requests — https://github.com/wri/terramatch-microservices/pull/692 , https://github.com/wri/terramatch-microservices/pull/695 ; SRP report configuration — https://github.com/wri/terramatch-microservices/pull/392 ; organisation leadership relation — https://github.com/wri/terramatch-microservices/pull/327 ; funding-type approval flow — https://github.com/wri/terramatch-microservices/pull/351
- Applies to: microservices
- Priority: mandatory

### A new reporting framework is a constant plus form wiring — not a one-off string

**Do:** add the key to `FRAMEWORK_KEYS` in `libs/database/src/lib/constants/framework.ts`, wire the reporting-framework form UUID (including disturbance-report form when that entity is in scope), expose `frameworkKey` on the Light DTO, and include the framework in filters that already key off `FRAMEWORK_KEYS`. **Don't:** scatter a raw string (`"barka-fund"`) in a single query, or resolve disturbance-report forms without the framework key.

- Evidence: barka-fund — https://github.com/wri/terramatch-microservices/pull/887 ; disturbance-report forms by framework — https://github.com/wri/terramatch-microservices/pull/900 , https://github.com/wri/terramatch-microservices/pull/901 , https://github.com/wri/terramatch-microservices/pull/904 ; terrafund-3 cohort filter — https://github.com/wri/terramatch-microservices/pull/641 ; financial report on reporting framework — https://github.com/wri/terramatch-microservices/pull/599
- Applies to: microservices
- Priority: mandatory

### Transifex form labels belong in the BE push path

**Do:** when the FE composes a label (tracking type/subtype, option lists), include that i18n id in `getI18nIdsForForm` / the form TFX push so translators see it. **Don't:** assume the website `t()` call is enough if the string is generated from form config on the server.

- Evidence: https://github.com/wri/terramatch-microservices/pull/891 , https://github.com/wri/terramatch-microservices/pull/894
- Applies to: microservices (`entity-service` forms)
- Priority: mandatory

---

## Maps, Geometry & GeoServer

_(Applies primarily to `wri-terramatch-website` map UI and `terramatch-microservices`
`research-service` / `libs/common/gwc`.)_

**Status — architecture addendum.** This section instantiates Top principle #10 (“follow the
established pattern”) for geospatial work. Individual bullets are grounded in the existing
`Map-mapbox` / GWC implementation, not each counted from a `roguenet` permalink unless
an Evidence line says otherwise.

### Extend the existing map stack — never invent a parallel Mapbox, layer, popup, or GeoServer client

**Do:** put new map behavior in the established seams — `src/components/elements/Map-mapbox/`
for orchestration, `src/constants/layers.ts` for the layer catalog and geometry variants,
`Map-mapbox/adapters/geoserver.ts` (`getGeoserverURL`) for WMTS URLs,
`src/constants/environment.ts` for `geoserverUrl` / `geoserverWorkspace`,
`apps/research-service/src/site-polygons/` for polygon APIs, and `libs/common/src/lib/gwc/`
via `invalidatePolygonTileCache` for tile truncation; reuse redesign primitives under
`src/redesignComponents/geospatial/`. **Don't:** add a second Mapbox wrapper, a second layer
registry, a second popup system, a one-off GeoServer URL builder, or a bespoke GWC client
inside a feature folder.
This is the same “one implementation per behavior / follow the established pattern” discipline
applied to a domain agents routinely reinvent.

- Evidence: "This is also not following previous patterns in this codebase... See how this pattern
  is established in `getBaseEntity`" —
  https://github.com/wri/terramatch-microservices/pull/122#discussion_r2064709610
- Evidence: "This hook should be used in all cases where we want to display the current
  framework name, instead of redefining it in lots of places." —
  https://github.com/wri/wri-terramatch-website/pull/379#discussion_r1680024660
- Applies to: both
- Frequency: architecture addendum (see Architecture § “Follow the pattern” / “One
  implementation per behavior”)

### Keep Mapbox, GeoServer tiles, API geometry, and media as separate pipes

**Do:** use GeoServer MVT tiles for scalable polygon/landscape display; use research-service
`mapIndex` for uuid/status (and related) attributes that drive filters and popups; load full
geometry only for edit, draw, or export (`SitePolygonFullDto` / GeoJSON export); render
geolocated media through `mediaMarkers.tsx` / `mediaSymbolLayer.ts` and
`useMapMedia`. **Don't:** fetch full site-wide GeoJSON into the client to “draw the map” when a
GWC vector layer already exists, push media through GeoServer, or treat Mapbox as the
system of record for polygon storage.
Mixing these pipes is the usual source of empty layers, huge payloads, and double-rendered
features.

- Applies to: website (contracts: research-service)
- Frequency: architecture addendum

### Keep geometry layer names in lockstep across DB views, GeoServer, FE, and GWC invalidation

**Do:** resolve published layer names through `POLYGON_GEOMETRY_VARIANTS` /
`getPolygonGeometryLayerName` / `resolveGeoserverLayerName`, and keep Mapbox
`"source-layer"` equal to the GeoServer layer name used in the WMTS `LAYER=` param
(e.g. `polygon_geometry_active`, not the Mapbox source id). Known variants:
`polygon_geometry` (unversioned / dashboard-form paths), `polygon_geometry_active`,
`polygon_geometry_deleted`; treat `polygon_geometry_approved` as unwired until DB view,
GeoServer publish, FE variant, and GWC mapping land together. **Don't:** hardcode layer-name
strings in feature code, invent a new variant in only one layer of the stack, or use a Mapbox
source id as `"source-layer"`.

- Applies to: both
- Frequency: architecture addendum

### When editing a polygon, hide the tile feature and draw with the existing Draw path

**Do:** filter the edited uuid out of tile layers, use the established Mapbox Draw flow
(`useMapDraw` / `interactions/draw`), persist via the existing polygon services, then invalidate
tiles. **Don't:** leave the GWC feature and the draft geometry both visible, or introduce another
draw library beside `@mapbox/mapbox-gl-draw`.

- Applies to: website
- Frequency: architecture addendum

### Coordinate popups and markers through the shared helpers — never attach competing Mapbox Popups

**Do:** register popups with `setActivePopup` / `clearActivePopup`, and reuse
`mediaMarkers.tsx` / `mediaSymbolLayer.ts` plus redesign `MapPopUp` / `PointMarker`.
**Don't:** construct ad hoc Mapbox `Popup` instances that bypass the coordinator, or mix DOM
markers and symbol layers for the same media set outside `useMapMedia`.

- Applies to: website
- Frequency: architecture addendum

### On geometry mutations, bust FE tiles and truncate GWC — never rely on only one

**Do:** rebuild WMTS URLs with `RND=${cacheKey}` / the map-area tile nonce when polygon
identity or visibility changes (`getGeoserverURL`, `useMapLayers`), and on create / version /
delete call `invalidatePolygonTileCache` for the appropriate `active` / `deleted` layers.
**Don't:** assume a browser refresh fixes hosted tiles, add a bespoke truncate HTTP client, or
ship a mutation that changes published geometry with only a FE nonce bump or only a BE
truncate.

- Applies to: both
- Frequency: architecture addendum

### Don't put class-validator on outbound GeoJSON library types

**Do:** keep response DTOs to `@ApiProperty` for geometry payloads; normalize GeoJSON once
in the established adapters/services. **Don't:** `@ValidateNested` (or other class-validator
decorators) on external GeoJSON types such as `FeatureCollection` on response DTOs — they
validate nothing on the way out and are pure noise.

- Evidence: "The only decorators needed for DTOs that are sent to the client are the `swagger`
  ones. the `class-validator` decorators are only needed to validate DTOs that are being received"
  — https://github.com/wri/terramatch-microservices/pull/294#discussion_r2344950428
- Applies to: microservices
- Frequency: ~10 (same rule as DTOs § “Response DTOs carry only Swagger…”)

### Never hardcode GeoServer URLs, workspaces, or credentials — and never confuse FE vs BE URL shape

**Do:** read GeoServer settings only from env helpers (`geoserverUrl` /
`geoserverWorkspace` on the website; `GEOSERVER_URL` / `GEOSERVER_WORKSPACE` /
`GEOSERVER_USER` / `GEOSERVER_PASSWORD` via `ConfigService` on microservices). Treat
the FE URL as an **origin only** (no `/geoserver` suffix — `getGeoserverURL` appends
`/geoserver/gwc/service/wmts?...`) and the BE URL as a **base that already includes
`/geoserver`** (truncate posts to `{GEOSERVER_URL}/gwc/rest/seed/...`). Keep FE and BE
workspace strings aligned for the same environment. **Don't:** hardcode `localhost:8081`,
`admin`/`geoserver`, or `wri` into feature code; don't paste the FE URL into BE config (missing
`/geoserver`) or the BE URL into FE config (yielding `/geoserver/geoserver/...`).
Local examples: FE `http://localhost:8081`, BE `http://localhost:8081/geoserver`. Hosted FE
defaults toward `https://geoserver-prod.wri-restoration-marketplace-api.com` unless overridden.

- Applies to: both
- Frequency: architecture addendum
- Tooling: website `.env` / `.env.local` (`NEXT_PUBLIC_GEOSERVER_*`); microservices `.env` /
  `.env.local.sample` (`GEOSERVER_*`); deploy injects `GEOSERVER_PASSWORD` from GitHub
  secrets — never commit it.

### Treat local Docker GeoServer and hosted staging/prod GeoServer as different deployments

**Do:** state in the PR which GeoServer was exercised (**local Docker** vs **hosted**), which
workspace was used, and whether dashboard mode’s `${geoserverWorkspace}_db` suffix
applied. Use local overrides (`NEXT_PUBLIC_GEOSERVER_URL=http://localhost:8081`,
`NEXT_PUBLIC_GEOSERVER_WORKSPACE=wri`, matching BE `GEOSERVER_*`) for Docker
compose on host port `8081`; use env-appropriate hosted workspaces (`wri_test` /
`wri_staging` / `wri_prod` from `defaultGeoserverWorkspace` unless explicitly overridden).
**Don't:** claim “GeoServer works” after only local verification when the change affects hosted
layers, GWC truncate, or workspace naming; don't point a local FE at prod GeoServer (or the
reverse) without an explicit, temporary override called out in the PR; don't copy local Docker
defaults (`wri`, `admin`/`geoserver`) into staging/prod config.
Local compose and hosted GeoServer differ in URL, workspace publication, auth, and layer
state — “works on my machine” against localhost is not evidence for hosted tile correctness.

- Applies to: both
- Frequency: architecture addendum

### App code consumes GeoServer — it does not redefine infra without an infra ticket

**Do:** consume env, build WMTS via `getGeoserverURL`, invalidate via
`invalidatePolygonTileCache`, and add FE layer entries only for layers that already exist (or are
being published in the same change set) in GeoServer. **Don't:** treat `docker/geoserver`
data-dir edits as product features, commit secrets, invent new published layer names without
aligned DB view + GeoServer publish + FE variant + GWC mapping, or “fix prod tiles” by
editing local `geoserver_data`.

- Applies to: both
- Frequency: architecture addendum

## API Design & JSON:API Contract

_(Applies to `microservices` — the active v3 backend. `website` consumes this contract through Connections; see the React section.)_

### Model every endpoint as a REST resource, never an RPC action

**Do:** POST creates a noun (`translations`, not `translate`); resource names and path segments are plural camelCase; identifying UUIDs live in the path, not the body or query. **Don't:** design a "verb" endpoint (`bulkUpload`, `validate`, `join-request`), and don't build separate `admin/` paths — admin behavior is gated by policy on the normal resource controller.

- Evidence: "When you're making a REST creation endpoint, you're creating a resource. This reads like an action (you don't create a `translate`, you create a `translation`)" — https://github.com/wri/terramatch-microservices/pull/463#discussion_r2641593505
- Evidence: "We do not have separate controllers for admins in v3... Access control should be handled through policies." — https://github.com/wri/terramatch-microservices/pull/605#discussion_r2909284497
- Frequency: ~45

### Every v3 endpoint returns a JSON:API document built with `buildJsonApi()`/`@JsonApiResponse` — never plain JSON

**Do:** build every response (including a create/update result) with the document builder and annotate with `@JsonApiResponse`. Request bodies use the shared `JsonApiBodyDto`/`JsonApiDataDto` helpers. **Don't:** return `res.json(...)`, a bare DTO, or a hand-rolled body-shape class.

- Evidence: "No endpoint in v3 should be sending a plain JSON response like this. If a response is required, it must be in JsonAPI format." — https://github.com/wri/terramatch-microservices/pull/25#discussion_r1876916017
- Evidence: "Remember that _all_ JSON endpoints in v3 are resource based. There should never be a simple non-JSON:API response like this." — https://github.com/wri/terramatch-microservices/pull/605#discussion_r2915269735
- Frequency: ~30

### Expose UUIDs, never integer database IDs, on any API surface

**Do:** put UUIDs in DTOs, resource IDs, and paths. **Don't:** send `userId`, `taskId`, or other numeric IDs to the client unless there's a demonstrated FE need — and even then, prefer to send the UUID and let the BE resolve internally.

- Evidence: "We should be favoring UUIDs for all API surface areas as much as possible." — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1942041463
- Evidence: "Whenever possible, the client should be using UUIDs everywhere and shouldn't even be aware of the numerical id." — https://github.com/wri/terramatch-microservices/pull/192#discussion_r2136690735
- Frequency: ~25

### A resource controller returns the same DTO shape and the same resource ID from every create/update endpoint

**Do:** keep create, update, and get endpoints for one resource type returning one DTO with a consistent ID. **Don't:** let two mutation endpoints on the same resource diverge — the FE connection cache folds responses together by ID and breaks if they don't match.

- Evidence: "A given resource controller should return the same payload (DTO) for all create and update endpoints so that the FE can expect a consistent shape" — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925822078
- Frequency: ~10

### Index endpoints return Light DTOs only, never sideload unrequested data, and return 0 results — not 404 — for an empty set

**Do:** keep list endpoints on the light/index DTO variant; use `document.addIndex` only there. **Don't:** eagerly sideload related data an index didn't request (payload size + query count), and don't throw `NotFoundException` for an index with no matches.

- Evidence: "index endpoints by definition must return the Light version of DTOs, and not sideload extra stuff unless specifically requested." — https://github.com/wri/terramatch-microservices/pull/201#discussion_r2183282190
- Evidence: "I don't think a 404 here makes sense. For an index endpoint, I usually prefer to simply return 0 results instead." — https://github.com/wri/terramatch-microservices/pull/308#discussion_r2361012885
- Frequency: ~15

### Never embed a full model or full related entity inside a DTO — nest a small, purpose-built DTO or fetch separately

**Do:** put only the couple of fields actually needed (uuid, name) on a nested reference, or a tiny dedicated DTO. **Don't:** put a raw Sequelize model, or another resource's full DTO, inside a DTO — he explicitly calls this "a pattern from PHP we're ditching in v3."

- Evidence: "We'd never want to include the full project on another entity's DTO; that's a pattern from PHP we're ditching in v3 ... A model cannot itself be an ApiProperty - it has to be a DTO" — https://github.com/wri/terramatch-microservices/pull/64#discussion_r1976021556
- Frequency: ~10

### Only add DTO fields, associations, and endpoints the client actually consumes — verify, don't speculate

**Do:** check FE usage (a field-audit spreadsheet, an actual PR consumer) before adding a DTO property; remove fields no consumer needs (`hidden`, `oldId`, Laravel model strings). **Don't:** ship a field "just in case" — the one accepted exception is genuine data-model completeness (a foreign-key association ahead of a known future need), never payload bloat.

- Evidence: "There are lots of fields on the spreadsheet that aren't represented in this lite DTO... Is it actually needed here?" — https://github.com/wri/terramatch-microservices/pull/64#discussion_r1975777051
- Evidence: "are these all needed in the FE as DTO properties? If they're not going to be referenced explicitly, please don't add them." — https://github.com/wri/terramatch-microservices/pull/507#discussion_r2730282725
- Frequency: ~20

### Sideloaded or mutated related resources go in JSON:API `included` — never bolted onto the primary resource as an ad hoc property

**Do:** return updated related records in `included` so the FE connection cache updates them; push increasingly common patterns (multi-id delete, delayed-job responses) down into the shared document-builder utility. **Don't:** attach related data as a custom field on the primary DTO.

- Evidence: "the endpoint should return all updated media in the `included` array of the JSON API response so that the client side cache for these models is updated." — https://github.com/wri/terramatch-microservices/pull/312#discussion_r2561101653
- Frequency: ~10

### Paginate honestly: declare pagination only when implemented, use `hasMany: true` otherwise, and paginate anything that can exceed ~100 rows

**Do:** specify `{ data: Dto, pagination: "number" }` for a genuinely paginated index and `hasMany: true` for one that always returns everything. **Don't:** fake pagination with a fixed limit and no offset handling, and don't leave an endpoint unpaginated if it can return more than roughly 100 records.

- Evidence: "This should not be pretending it supports pagination - this endpoint returns at most 20 entries no matter the query params and never manages an offset." — https://github.com/wri/terramatch-microservices/pull/494#discussion_r2729799911
- Evidence: "How many records can this endpoint return? … If it's > 100, we need to use pagination on this endpoint." — https://github.com/wri/terramatch-microservices/pull/932#discussion_r3855422253
- Frequency: ~10

### Be frugal with network requests; GET must never mutate state

**Do:** combine near-duplicate GETs from the same component, prefer a bulk endpoint over many parallel per-item requests, and parallelize independent calls with `Promise.all`. **Don't:** trigger backend mutation from a GET — use POST/PATCH — and don't discard a fetched result.

- Evidence: "When I see two nearly identical GET requests in a component it automatically makes me wonder if the responses from these endpoints could be combined into a single request. Especially since our target audience is potentially on a bad internet connection." — https://github.com/wri/wri-terramatch-website/pull/248#discussion_r1633655344
- Evidence: "A `GET` request should not be causing any modification in the BE. It should be a `POST` or `PATCH` if it causes mutations." — https://github.com/wri/wri-terramatch-website/pull/248#discussion_r1633846060
- Applies to: both
- Frequency: ~15

### Relate a disturbance to a polygon with `disturbanceId` — never sideload the full disturbance report on the polygon DTO

**Do:** persist `site_polygons.disturbance_id` when the disturbance report is submitted, and expose that FK (or a tiny uuid/name reference) on the polygon resource. **Don't:** embed a full disturbance-report payload on the site-polygon review DTO — that was tried and reverted.
Nathan’s “never embed a full related entity inside a DTO” rule is the parent; this is the geo instance of it.

- Evidence: column + populate on submit — https://github.com/wri/terramatch-microservices/pull/292 , https://github.com/wri/terramatch-microservices/pull/942 ; review-page sideload reverted — https://github.com/wri/terramatch-microservices/pull/939 , https://github.com/wri/terramatch-microservices/pull/948
- Applies to: microservices (`research-service`)
- Priority: mandatory

---

## DTOs & Validation

### All request validation lives in DTO decorators — never manual checks in controllers or services

**Do:** express constraints with `class-validator` decorators on the DTO (`@IsOptional`, `@IsBoolean`, enum lists); create a dedicated params/query DTO for an endpoint rather than adding an `if` in the controller. **Don't:** hand-roll `plainToInstance` + `validate()` in a service, or re-validate in both controller and service.

- Evidence: "This should be handled by validation decorators in the request DTO ... Ideally, by the time the request makes it to the controller, the inputs have been more or less validated" — https://github.com/wri/terramatch-microservices/pull/25#discussion_r1880583370
- Evidence: "Manual validation is also a red flag for me - validation should be handled by the automatic controller body validation process." — https://github.com/wri/terramatch-microservices/pull/613#discussion_r2991357239
- Frequency: ~25

### Query/param DTOs are endpoint-specific and extend the shared base — don't overload a generic one

**Do:** create a query DTO per endpoint (`extends IndexQueryDto`, which already supplies `page`/`sort`); type array params as `string[]` with `isArray: true` and `@IsArray()`. **Don't:** reuse a generic entity query DTO as a grab-bag, redeclare fields the base already provides, or accept a comma-joined string via a custom `@Transform`.

- Evidence: "Let's also have a query DTO specific to this endpoint. The entity one is already overloaded, and is not meant to be a generic grab bag" — https://github.com/wri/terramatch-microservices/pull/156#discussion_r2085153612
- Evidence: "Instead of using a comma separated list, the more typical pattern for this API is to use a `string[]` here." — https://github.com/wri/terramatch-microservices/pull/731#discussion_r3204699505
- Frequency: ~25

### Response DTOs carry only Swagger (`@ApiProperty`) decorators — `class-validator`/`class-transformer` decorators are for inbound DTOs only

**Do:** keep response DTOs to `@ApiProperty` alone. **Don't:** decorate a response DTO with `@IsString`, `@ValidateNested`, or `@Type` — they validate nothing on the way out and are pure noise (worse, `@ValidateNested` on an external-library type like GeoJSON's `FeatureCollection` silently validates nothing at all).

- Evidence: "The only decorators needed for DTOs that are sent to the client are the `swagger` ones. the `class-validator` decorators are only needed to validate DTOs that are being received" — https://github.com/wri/terramatch-microservices/pull/294#discussion_r2344950428
- Frequency: ~10

### Build DTOs through the constructor (`populateDto`, a `props` argument) — never assign fields after construction

**Do:** pass every computed value into the DTO constructor as a second `props` argument (`new Dto(model, { computedField })`); use `populateDto<ThisDto>(this, data)` with the explicit generic. **Don't:** create a DTO and then assign extra properties onto it afterward — this bypasses the type-safety the pattern exists to provide.

- Evidence: "By convention established in the other DTOs in this repo, these should get assigned with an additional `props` argument to the DTO instead of adding properties after it's been created." — https://github.com/wri/terramatch-microservices/pull/247#discussion_r2229521231
- Evidence: "when using `populateDto` in a constructor, you have to explicitly provide the type or the compiler checks don't work correctly" — https://github.com/wri/terramatch-microservices/pull/445#discussion_r2612885209
- Frequency: ~20

### `@ApiProperty` needs `type:` only when the member is nullable/optional — omit it when the TS type is already concrete

**Do:** add `type: String` (etc.) alongside `nullable: true` because Swagger generation can't infer through a union; leave `type:` off a concrete, non-nullable field so there's only one place to update if the type changes.

- Evidence: "`type` is only needed for members that can be null / undefined. I prefer to let the type inference do its work so we don't have to update in multiple places" — https://github.com/wri/terramatch-microservices/pull/311#discussion_r2377016674
- Frequency: ~10

### Keep the same logical field consistent in type and nullability across bulk/single DTOs, the service, and stored JSON

**Do:** audit a property across every place it appears (bulk DTO, single DTO, service, stored JSON structure) and make it the same type everywhere. **Don't:** let one path treat a value as a string and another as a number.

- Evidence: "Also this same property is a number in the DTO below. They should be consistent" — https://github.com/wri/terramatch-microservices/pull/619#discussion_r2932918260
- Frequency: ~7

### Every filter key a service honors must be declared on the query DTO

**Do:** add a documented property to the query DTO for any filter the service implementation reads. **Don't:** let a service accept a filter key that isn't reflected in the DTO — the generated FE client strictly types its `filter` prop from what's declared there.

- Evidence: "The point of this change and those like it is to make sure that any filter key the service uses is also documented in the DTO ... The FE now strictly types its connection `filter` prop based on what's in the DTO" — https://github.com/wri/terramatch-microservices/pull/227#discussion_r2196071037
- Frequency: ~5

### Add a DTO / filter field only when a real consumer needs it — then add it everywhere it must stay consistent

**Do:** put a new attribute on Light and Full if the FE reads it from both, declare the matching query-DTO filter, and keep CSV headers in camelCase matching the DTO. **Don't:** add “just in case” fields, leave a filter that the service ignores, or export `snake_case` headers that the FE mapper does not expect.

- Evidence: project/site/nursery Light fields — https://github.com/wri/terramatch-microservices/pull/88 , https://github.com/wri/terramatch-microservices/pull/146 , https://github.com/wri/terramatch-microservices/pull/551 , https://github.com/wri/terramatch-microservices/pull/579 ; report uuid on child reports — https://github.com/wri/terramatch-microservices/pull/810 , https://github.com/wri/terramatch-microservices/pull/811 , https://github.com/wri/terramatch-microservices/pull/819 ; organisation fields — https://github.com/wri/terramatch-microservices/pull/606 ; `passwordNotNull` — https://github.com/wri/terramatch-microservices/pull/714 ; CSV camelCase — https://github.com/wri/terramatch-microservices/pull/957 ; `q` / missing filters — https://github.com/wri/terramatch-microservices/pull/100 , https://github.com/wri/terramatch-microservices/pull/105 ; planting-status from latest approved report — https://github.com/wri/terramatch-microservices/pull/428
- Applies to: microservices
- Priority: mandatory

---

## Data Layer (Sequelize, Query Efficiency)

### Never issue N+1 queries — batch-load associations in the same query

**Do:** fetch related records with `include`, a join, or one bulk lookup keyed by id and map the result back onto DTOs. **Don't:** issue a follow-up query per row in a loop, per-DTO builder, or per light-DTO construction — this is, in Nathan's own words, one of the main reasons the legacy API was slow, and the standard he holds v3 to explicitly.

- Evidence: "The way this is written now, it's an N+1 query because you're fetching all the Media, then fetching the user for each one. This is one of the main problems that is making the PHP API slow" — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2046070804
- Evidence: "This controller is issuing a _ton_ of superfluous DB queries... This is the definition of N+1 queries, and this kind of pattern is one of the main reasons the terramatch BE is so slow today" — https://github.com/wri/wri-terramatch-api/pull/56#discussion_r1507840729
- Applies to: microservices, legacy-api
- Frequency: ~55

### Limit fetched columns with `attributes`/`select` to exactly what the caller needs

**Do:** specify `attributes: [...]` on every `findOne`/`findAll`/`include`, especially against large tables (users, projects, organisations). **Don't:** pull whole rows — and whole associated models — when only a UUID or name is used downstream.

- Evidence: "`v2_projects` is a very large table - please only pull the attributes you need in this query." — https://github.com/wri/terramatch-microservices/pull/312#discussion_r2561092415
- Applies to: microservices, legacy-api
- Frequency: ~25

### Use the `Subquery` builder (or a static model helper) for "the ID(s) of X" instead of fetching rows to feed another query

**Do:** add a static helper on the owning entity built with `Subquery.select(Model, "id").eq(...).literal` and use it inline in a `where`. **Don't:** `findAll()` a set of rows purely to extract an ID list for a second query — that's still effectively N+1, and Laravel/Eloquent equivalents (`select('id')` subqueries, `exists()`) apply the same idea in the legacy repo.

- Evidence: "why pull all these ids from various tables when this could all be handled with subqueries? … The way it's structure now is almost N+1." — https://github.com/wri/terramatch-microservices/pull/494#discussion_r2710328063
- Evidence: "This should still use `select('id')` instead of `pluck('id')`. That will use a subquery instead of loading all the project report ids into memory just to turn around and send them back to the DB." — https://github.com/wri/wri-terramatch-api/pull/728#discussion_r1983691580
- Applies to: microservices, legacy-api
- Frequency: ~25

### Never re-fetch a model already held in memory, or query for a value you already have

**Do:** pass already-loaded model instances between controller and service layers, and use memoizing loaders (`task.loadReports()`) that return immediately once loaded. **Don't:** re-query a record to get one extra column — widen the original `attributes` list instead — and don't query the DB for an ID you're already holding.

- Evidence: "This is a very concerning pattern. We should definitely avoid re-fetching an already loaded model without a very good reason." — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2056740577
- Evidence: "The controller calling this method has already fetched the full site polygon record for each of these IDs - please have the controller just pass the models in instead of fetching them twice." — https://github.com/wri/terramatch-microservices/pull/437#discussion_r2608989792
- Applies to: microservices, legacy-api
- Frequency: ~20

### Do aggregation and bulk writes in SQL, not by looping and reducing in application code

**Do:** use `count()`, `SUM`/`fn`, `bulkCreate`, and a single `Model.update({...}, { where })` for many-row writes, then batch remaining per-row work with `Promise.all`. **Don't:** `create`/`save` inside a loop (bother fixing it once it's likely to exceed ~10 rows per request), or fetch all rows just to sum/count them in JS.

- Evidence: "Any time I see `create` in a loop, I want to move it to a bulk create ... I would only bother if this is likely to be more than 10 or in any given request." — https://github.com/wri/terramatch-microservices/pull/315#discussion_r2382812356
- Evidence: "This would be more efficient with `count()`" — https://github.com/wri/terramatch-microservices/pull/58#discussion_r1987656274
- Applies to: microservices, legacy-api
- Frequency: ~30

### Push filtering into the query — where clauses, subqueries, scopes — never fetch-then-filter in application memory

**Do:** express a filter as a `where` condition or scope so the DB does the work. **Don't:** load a broad set of rows into memory and `.filter()` them in JS ("almost N+1").

- Evidence: "why pull all these ids from various tables when this could all be handled with subqueries? … The way it's structure now is almost N+1." — https://github.com/wri/terramatch-microservices/pull/494#discussion_r2710328063
- Applies to: microservices
- Frequency: ~10

### Entity/column definitions must mirror the live database schema exactly

**Do:** match type, size, nullability, unsigned-ness, defaults, uniqueness, and `paranoid` status to the real schema (`BIGINT.UNSIGNED` for Laravel IDs, `TEXT` vs `STRING(255)` exactly as in the DB, `@AllowNull` only where the DB allows it) — the Sequelize entities are meant to become the schema source of truth. **Don't:** guess; verify with `describe table` against the actual DB. Columns still present but unused stay in the entity marked `@deprecated`, rather than being silently dropped from the model.

- Evidence: "We need to keep these types as close to what's in the current schema as possible because this codebase will eventually become the source of truth" — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1941698148
- Evidence: "I think we want the Entity to still match what's in the DB. I've been adding a `@deprecated` flag with a comment" — https://github.com/wri/terramatch-microservices/pull/145#discussion_r2066919534
- Applies to: microservices
- Frequency: ~30

### Don't redeclare what the base Model/ORM already provides

**Do:** omit `createdAt`/`updatedAt` (Sequelize's base `Model` manages them), `paranoid: false`/`timestamps: true` (the defaults), `STRING(255)` (255 is the default), and `field:` under `underscored: true`. **Don't:** manually set timestamps, UUIDs, or other framework-managed columns — use `HasUuid`/`HasTimestamps`-equivalent behavior instead.

- Evidence: "Please don't specify `createdAt` or `updatedAt`, these are handled by the base Model class." — https://github.com/wri/terramatch-microservices/pull/311#discussion_r2377078395
- Evidence: "`paranoid: false` is the default. Why was it needed in all these clauses?" — https://github.com/wri/terramatch-microservices/pull/243#discussion_r2223700851
- Applies to: microservices
- Frequency: ~25

### Model relationships properly — FK + typed association, scoped polymorphic `@BelongsTo` — never a hand-rolled join or lookup map

**Do:** add `@ForeignKey`/`@BelongsTo` even ahead of immediate need for any `*_id` column pointing at another table; model polymorphic relations with scoped associations (`constraints: false`, `scope: {...}`). **Don't:** define a second entity class for a table that already has one, or build a manual class-map for a polymorphic relation.

- Evidence: "This should also get a foreign key association, even if we don't necessarily need it right now: `@ForeignKey(() => User)`" — https://github.com/wri/terramatch-microservices/pull/25#discussion_r1878650730
- Applies to: microservices
- Frequency: ~15

### Escape every value interpolated into raw SQL

**Do:** run user-supplied values through the framework's own escaping (`sequelize.escape()`/the `Subquery` builder's escaping) before interpolating into a `literal()`. **Don't:** ever fall back to unescaped input, even as a rare-path default.

- Evidence: "`slug` needs to be escaped to prevent an injection attack ... `${sql.escape(slug)}`" — https://github.com/wri/terramatch-microservices/pull/83#discussion_r1991922387
- Applies to: microservices
- Frequency: ~5

### Aggregated entity metrics must count only approved (or otherwise status-appropriate) child records — confirm the rule with product

**Do:** filter report-derived aggregates (trees planted, seedlings grown) to `approved` reports specifically; a raw report _count_, by contrast, includes everything. **Don't:** port a PHP aggregation that mistakenly used submitted-but-unapproved data — that was a known bug, not a pattern to replicate.

- Evidence: "A general guidance from product ... all aggregated fields on these entities should be based only on approved entities. The fact that some of them in PHP are using the submitted entities instead is a mistake." — https://github.com/wri/terramatch-microservices/pull/64#discussion_r1975792176
- Applies to: microservices, legacy-api
- Frequency: ~10

### Migrations are schema-only; data changes are one-off scripts; never edit a migration that has already run

**Do:** write schema changes as migrations and data backfills/conversions as one-off commands/scripts. To fix a migration that hasn't shipped to production yet, run it down, edit it in place, and run it up again after release. **Don't:** add a "revert" migration for an unreleased mistake, or delete an existing migration entry.

- Evidence: "this is just a data migration. Please do it in a one off instead. umzug should be used for schema migrations only." — https://github.com/wri/terramatch-microservices/pull/685#discussion_r3076462848
- Evidence: "Since this migration is old, it won't be run anywhere again. This needs to be a new change migration to actually take effect." — https://github.com/wri/wri-terramatch-api/pull/1017#discussion_r2345374524
- Applies to: microservices, legacy-api
- Frequency: ~10
- Note (one-off / REPL scripts): batch-process models with the `PaginatedQueryBuilder` and the `batchFindAll` utility built for REPL code, rather than managing batches by hand. A REPL script already runs in the context of its service app, so pass what it needs in as script args. — https://github.com/wri/terramatch-microservices/pull/632#discussion_r2990734350 ; https://github.com/wri/terramatch-microservices/pull/633#discussion_r2990992829

### Only open a transaction when multiple DB operations must be atomic; commit/clean up in `finally`

**Do:** wrap only genuinely multi-step atomic work in a transaction, using the entity's `sql`/transaction-guard getter (which also throws a clear error if the connection is missing); put the commit/cleanup in a `finally` block so every return path, including early ones, still runs it. **Don't:** wrap a single `update`/`destroy` call in a transaction — it adds nothing.

- Evidence: "I'm not sure I see any benefit to putting this single query in a transaction." — https://github.com/wri/terramatch-microservices/pull/664#discussion_r3042697799
- Evidence: "Instead of needing to remember to commit this transaction, it's a little cleaner to move this to a `finally` block after the catch below." — https://github.com/wri/terramatch-microservices/pull/326#discussion_r2409237180
- Applies to: microservices, legacy-api
- Frequency: ~10

### Nullable status-like columns must be migrated NULL-first

**Do:** when a status column changes from NOT NULL / enum-ish to optional, make it nullable in a first migration, then change allowed values. **Don't:** tighten or rewrite values in the same migration that still forbids NULL — it fails on existing rows.

- Evidence: project QA status — https://github.com/wri/terramatch-microservices/pull/880 , https://github.com/wri/terramatch-microservices/pull/881
- Applies to: microservices
- Priority: mandatory

### Absence of a change request is `NULL`, not `"no-update"`

**Do:** keep `updateRequestStatus` `NULL` until a real `UpdateRequest` exists. Active change-request slugs are `draft` | `pending-approval` | `approved` | `information-required`. **Don't:** write `"no-update"` onto the entity as a sentinel — that was a PHP leftover and breaks FE typing.

- Evidence: https://github.com/wri/terramatch-microservices/pull/922 , https://github.com/wri/terramatch-microservices/pull/919
- Applies to: microservices
- Priority: mandatory

---

## Error Handling & Logging

### Throw specific HTTP exceptions — never a generic `Error`

**Do:** throw `NotFoundException` for a missing resource, `BadRequestException` for bad input or a reference to something outside the endpoint's main resource, and `InternalServerErrorException` for a "should never happen" misconfiguration (e.g. missing DB connection) that should fail loudly. **Don't:** let a plain `Error` bubble to the API layer.

- Evidence: "we should never be throwing a generic `Error` in v3 code, especially in a controller. A property HTTP exception is required." — https://github.com/wri/terramatch-microservices/pull/494#discussion_r2710294805
- Evidence: "Please try not to throw generic errors. In this case, I think a NotFoundException() is more appropriate, and it will provide a better response to the client." — https://github.com/wri/terramatch-microservices/pull/311#discussion_r2377041999
- Applies to: microservices
- Frequency: ~20

### Document every reachable client-facing exception with `@ExceptionResponse`; never document `InternalServerErrorException`

**Do:** enumerate every `BadRequestException`/`NotFoundException`/`UnauthorizedException` an endpoint (or anything it calls into) can throw. **Don't:** document ISE — it isn't actionable by the client since it isn't the result of bad input.

- Evidence: "This should have `@ExceptionResponse`s to declare which error codes are possible." — https://github.com/wri/terramatch-microservices/pull/170#discussion_r2101575560
- Evidence: "I don't think it's useful to document InternalServerErrorException. ... It's not actionable on the client end because it isn't the result of bad input" — https://github.com/wri/terramatch-microservices/pull/164#discussion_r2132866583
- Applies to: microservices
- Frequency: ~10

### Never silently no-op a requested mutation — enforce the contract with an explicit error

**Do:** throw when a client asks to update/delete something that cannot be (e.g. a pending record) or supplies mutually exclusive params. **Don't:** quietly skip the requested change and return success — silence on a contract break is itself a bug.

- Evidence: "it's a breaking in the contract of the endpoint to not update something that was asked to be updated and also not complain about it" — https://github.com/wri/terramatch-microservices/pull/31#discussion_r1894303999
- Applies to: microservices
- Frequency: ~10

### Validate everything up front, then write — never leave a record half-mutated because a later step failed

**Do:** fetch and verify every referenced record/framework/role in one pass, throw if anything is missing, and only then destroy/create in a batch. **Don't:** destroy existing associations before confirming the new ones are all valid.

- Evidence: "the validation of the requested frameworks and roles should happen before the user update is saved and anything is created / destroyed. We want to avoid an endpoint that errors due to bad data from the FE leaving a user in a bad state." — https://github.com/wri/terramatch-microservices/pull/613#discussion_r2991457668
- Applies to: microservices
- Frequency: ~5

### Log through the shared logger utility — never `console.*` — and pass the error object so it reaches Sentry with a stack trace

**Do:** use `Log`(website) / `TMLogger`(microservices), instantiated per class where needed, for anything worth keeping; pass the caught error as a second argument to `.error()`. **Don't:** leave `console.log`/`console.debug`/`console.warn` in a PR, even in "temporary" code, tests, or Storybook stories.

- Evidence: "There should be no `console` calls in this repo. Please use the `TMLogger`." — https://github.com/wri/terramatch-microservices/pull/170#discussion_r2101595654
- Evidence: "If you pass the error as a second argument, we'll also get stack traces and some additional info in Sentry" — https://github.com/wri/terramatch-microservices/pull/224#discussion_r2183824016
- Applies to: both, legacy-api
- Frequency: ~55

### Don't silently default when the situation is actually an error; log at warn/error, not info, so it surfaces in Sentry

**Do:** treat a service's inability to produce data it should always produce as an error condition (log/throw), not a quiet fallback (`?? {}`). **Don't:** use `log`/`info` level for something that actually indicates a problem — a plain log doesn't show up in Sentry.

- Evidence: "Is a default of no data really appropriate here? It seems like if the service can't build a DTO for the new version, that's an error." — https://github.com/wri/terramatch-microservices/pull/458#discussion_r2641619872
- Applies to: microservices
- Frequency: ~5

### Error messages must state exactly what was determined, and reference values actually passed in

**Do:** phrase an error to match the check that actually ran ("the user already exists," not "already part of this programme" when only existence was checked), and derive message text from the real prop/param values. **Don't:** hardcode content in an error message that's available as a variable, or overstate what a check proved.

- Evidence: "This error message is misleading - all you've determined here is that the user already exists." — https://github.com/wri/terramatch-microservices/pull/585#discussion_r2866588185
- Applies to: both
- Frequency: ~7

### Deleting a draft/started entity must define what happens to child reports — don’t 500

**Do:** if product allows deleting a started nursery (or similar) that already has reports, encode that in the processor/policy and cascade/block explicitly. **Don't:** leave the FK to throw a generic database error.

- Evidence: https://github.com/wri/terramatch-microservices/pull/873
- Applies to: microservices
- Priority: mandatory

---

## React & Frontend

_(Applies to `wri-terramatch-website`.)_

### Type every component `FC<Props>` (or `FC<PropsWithChildren<Props>>`) — one default-exported component per file, matching the filename

**Do:** declare `export const Name: FC<Props> = (...) => {...}` (even with zero props, since `FC` constrains the return type), then `export default Name`; for components accepting children, use `FC<PropsWithChildren<Props>>` instead of adding `children: ReactNode` by hand. **Don't:** use a plain function declaration or an inline-typed destructured parameter, and don't export more than one component from a file unless the extras are purely internal.

- Evidence: "Typically we create these as const FCs and then export default. Let's stick to that as a convention in this library." — https://github.com/wri/wri-terramatch-website/pull/1727#discussion_r2699619634
- Evidence: "it's useful even when there are no props because it ensures the return type of the function matches a valid component type" — https://github.com/wri/wri-terramatch-website/pull/2320#discussion_r3190188301
- Frequency: ~55

### Wrap every user-facing string in `t()` from `useT` — build whole sentences, never concatenate translated fragments

**Do:** route every rendered string through `t()` — labels, buttons, placeholders, `alt` text, tooltips, aria-labels, notification titles, error/validation messages, and option lists (via a `useMemo` + `useT` hook). Pass a full sentence to `t()` with `{placeholder}` interpolation params rather than assembling it from separately-translated pieces, since sentence order isn't universal across languages. **Don't:** translate punctuation-only placeholders (`"-"`) or genuinely mocked prototype data, and don't remove an existing `t()` call — that's a regression.
**Exception — Admin-only flows.** Components used _only_ in Admin (react-admin) flows do not need `t()`. Nathan applies this both ways: he waives translation on admin-only components, and flags the _removal_ of a `t()` call as a bug when the component is not admin-only. When it's unclear whether a component is admin-only, wrap it.

- Evidence: "This translation is problematic because it's making assumptions about the order of a sentence that only holds true for EN." — https://github.com/wri/wri-terramatch-website/pull/173#discussion_r1605355651
- Evidence: "These are going to be used in our PD FE, so all text needs to be wrapped in `t` from `useT`" — https://github.com/wri/wri-terramatch-website/pull/1727#discussion_r2699629039
- Evidence (exception): "for components that are admin-only, we don't need to wrap in translation." — https://github.com/wri/wri-terramatch-website/pull/250#discussion_r1635495298
- Evidence (exception, applied in reverse): "This one is not admin-only though, so please bring back the translation this change removed." — https://github.com/wri/wri-terramatch-website/pull/250#discussion_r1635498974
- Frequency: ~85

### Access v3 data only through Connections — never `useSelector`, direct store reads, or calling generated API functions from a component

**Do:** declare data requirements via `useXConnection()` hooks backed by `v3Resource(...)`/the connection builder. If no connection exists for a need, build one by hand following an existing example. **Don't:** dig into the Redux store directly from component code, or call a generated API endpoint function inline.

- Evidence: "The generated API methods in v3 are not meant to be used directly in components. Please read up on the connection system" — https://github.com/wri/wri-terramatch-website/pull/820#discussion_r1925853001
- Evidence: "Component code should not be digging into the redux store directly." — https://github.com/wri/wri-terramatch-website/pull/1882#discussion_r2818809603
- Frequency: ~45

### Connections own loading, mutation, and cache invalidation — don't bolt manual refetch/retry/pruning on top

**Do:** trust `isLoaded`/`enabled` and automatic refetch-on-param-change; mutation methods are fire-and-forget, observed via `useUpdateComplete`/`useRequestSuccess`, never `await`ed or wrapped in try/catch. **Don't:** add a retry counter, a manual `refetch` on data the store already invalidates correctly, or prune the cache without a concrete reason — if something doesn't refetch as expected, fix the connection, don't work around it in the component.

- Evidence: "If the filter params change, the connection should notice that the requested data is different and refetch automatically. If that's not working, then let's fix up the connection implementation so it does." — https://github.com/wri/wri-terramatch-website/pull/1226#discussion_r2103093718
- Evidence: "This method is not asynchronous, so await is not needed here. It also means that the error catch below will never trigger from an API failure, and the success message will show before the request has even completed." — https://github.com/wri/wri-terramatch-website/pull/1270#discussion_r2183920032
- Frequency: ~35

### Reselect discipline: input selectors return stable references; use `selectorCache` only with props; filter to what was actually requested

**Do:** have selectors passed to `createSelector` return the identical object when their inputs haven't changed, key `selectorCache` on connection props when present, and map index results off `indexMeta.ids` rather than the whole store. **Don't:** create a fresh object on every selector call, or return every record in the store regardless of what was requested.

- Evidence: "It's important for the members of the first argument array to `createSelector` to only return a unique object result if the inputs have changed, whenever possible." — https://github.com/wri/wri-terramatch-website/pull/745#discussion_r1896221896
- Frequency: ~10

### Memoize deliberately — `useCallback` for handlers passed to children, `useMemo` for derived data used as props — but skip pointless wrappers

**Do:** wrap any function passed as a prop to a child component; combine related derived values into one `useMemo`. **Don't:** wrap a trivial boolean expression in `useMemo`, or add a `useCallback` that only forwards to a state setter/another prop — pass the function directly instead.

- Evidence: "To avoid unnecessary re-renders, all callbacks passed to components should be wrapped in `useCallback`" — https://github.com/wri/wri-terramatch-website/pull/1733#discussion_r2709954128
- Evidence: "It's odd to have `useCallback`s that don't do anything put pass args to another method. Any reason the uses of these can't just use the `set` method instead?" — https://github.com/wri/wri-terramatch-website/pull/2111#discussion_r2990415431
- Frequency: ~25

### Give `useEffect` an explicit, honest dependency array; prefer `useOnMount`/`useOnUnmount` for mount/unmount effects

**Do:** pass `[]` for a genuinely mount-only effect, and use the codebase's `useOnMount`/`useOnUnmount` helpers instead of a bare `useEffect(fn, [])` for readability. **Don't:** disable `react-hooks/exhaustive-deps` to paper over a real dependency gap — that's usually a sign the effect is wrong, not the lint rule.

- Evidence: "I assume this is meant to only run once, instead of on every render. To accomplish that, `[]` is needed for the `dependencies` parameter to `useEffect`" — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625049168
- Evidence: "you probably do want this recalculating when `values` changes, so the eslint disable is probably not appropriate." — https://github.com/wri/wri-terramatch-website/pull/1391#discussion_r2364378010
- Frequency: ~15

### Don't use `react-if` (`<If>`, `<When>`, `<Then>`, `<Else>`) in new or refactored code

**Do:** use a plain ternary or `&&`. **Don't:** reach for `react-if` — Nathan is actively removing it from the codebase because its children get constructed in memory even when hidden, with real performance cost.

- Evidence: "Please avoid using `react-if` in new component code. One of my major pieces of tech debt cleanup for this spring / summer is going to be to remove react-if from the codebase entirely." — https://github.com/wri/wri-terramatch-website/pull/2117#discussion_r2991637809
- Frequency: ~15

### Move context-free functions, constants, and nested components out of the component body

**Do:** define anything that doesn't read component props/state/hooks at module scope, including a lookup map, a `forwardRef` adapter, or a helper the render logic calls. **Don't:** define a component inside another component's render — pass a ref as a prop instead if that was the reason.

- Evidence: "Please move this component creation out of the body of the parent component. This is pretty inefficient and I'd consider it an anti pattern. If the ref is needed, it can be passed as a prop." — https://github.com/wri/wri-terramatch-website/pull/1270#discussion_r2183259653
- Frequency: ~20

### Render with real, conditionally-selected components — not inline render functions or IIFEs inside JSX

**Do:** turn a `renderXCards()` helper or a `{(() => {...})()}` block into an actual sub-component, one per variant, and conditionally render the right one. **Don't:** build JSX for every variant on every render only to display one — it defeats React's reconciliation and gets rebuilt needlessly each time.

- Evidence: "this method of choosing what to render is a bit of a code smell. It's going to have performance problems because the results of `renderCards()` below is freshly calculated on ever render." — https://github.com/wri/wri-terramatch-website/pull/2591#discussion_r3424745191
- Frequency: ~8

### Prefer many small components over large ones

**Do:** split a component once it accumulates lots of functions/state above the render, or once it renders many report/status/entity variants — one small component per variant reads far better than one large one branching internally. **Don't:** let a single file grow "almost impossible to reason through."

- Evidence: "I am always in favor of more small components over ones that have a lot of extra functions / state / code above the render portion." — https://github.com/wri/wri-terramatch-website/pull/1786#discussion_r2734197749
- Frequency: ~8

### Don't leak `undefined`/`false` into the DOM `className` — use `classNames` object syntax

**Do:** pass conditional classes as `{ "cursor-pointer": cond }` and let `classNames(...)` handle optional strings directly. **Don't:** wrap a possibly-`undefined` value alone in a template string (it renders the literal text `"undefined"`), or write `cond && "class"` where `cond` can be `false`.

- Evidence: "it looks like `className` can be `undefined`, which we wouldn't want to leak into the DOM. It appears to be leaking in because of the odd practice of wrapping the variable by itself in a template string." — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1625019988
- Frequency: ~5

### Read context via hooks inside the consumer — don't thread context values through props

**Do:** call `useFrameworkContext`/`useShowContext` (etc.) directly in the component/hook that needs the value. **Don't:** add a new prop or hook argument to carry something that's already available from an existing context.

- Evidence: "There's no need to pass the framework in here. The `useTableStatus` hook can use `useFrameworkContext` internally." — https://github.com/wri/wri-terramatch-website/pull/555#discussion_r1803793254
- Frequency: ~10

### Format dates and numbers for the user's locale — never hard-code a format

**Do:** use `toLocaleDateString`/`Intl.DateTimeFormat` for both display values and placeholders, and `toLocaleString()` for numbers; confirm exact formats with product. **Don't:** hard-code `MM/DD/YY` or strip out existing `toLocaleString()` calls.

- Evidence: "Please check with product on this format. In a lot of places we use `toLocaleDateString` on a date instance to get the correct format for the user." — https://github.com/wri/wri-terramatch-website/pull/2034#discussion_r2913771578
- Frequency: ~8

### Keep the browser console clean — a stream of errors in development must never reach production

**Do:** watch the console while developing and fix what's generating errors/warnings before merging. **Don't:** dismiss console noise as harmless — Nathan has caught production-bound bugs this way.

- Evidence: "Please keep an eye on the JS console during development. This one was generating a non-stop stream of errors... definitely shouldn't have snuck out to production." — https://github.com/wri/wri-terramatch-website/pull/919#discussion_r1950218835
- Frequency: ~5

---

### Render user-entered text as text; sanitize real HTML with DOMPurify

**Do:** Render plain-text values as text and keep line breaks with CSS (`white-space: pre-line`). When content really is HTML (admin rich text), pass it through `DOMPurify.sanitize` — `isomorphic-dompurify` is already a dependency — before `dangerouslySetInnerHTML`. **Don't:** Replace `\n` with `<br />` and inject the result, or pass API values straight into `dangerouslySetInnerHTML`.
React escapes text by default; `dangerouslySetInnerHTML` turns that off, so any unsanitized value becomes a cross-site scripting risk.

- Source: React — dangerouslySetInnerHTML — https://react.dev/reference/react-dom/components/common ; OWASP — Cross Site Scripting Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- TerraMatch today: 13 `dangerouslySetInnerHTML` call sites; only the 2 confirm pages sanitize with DOMPurify. microservices has no HTML sanitizer, so the website is the last line of defense.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: website

### Key lists by a stable id, never by array index

**Do:** Use the item's `uuid` (or another stable id) as `key`. Keep the index only for static lists that never reorder, filter, insert or remove items. **Don't:** Use `key={index}` on lists users can edit, filter or sort.
React matches component state to keys. When an item is removed, index keys shift and state such as input values or open menus moves to the wrong row.

- Source: React — Rendering Lists (keys) — https://react.dev/learn/rendering-lists
- TerraMatch today: 54 index-style keys in the website. Example: `DisturbanceAffectedSites.tsx` removes sites by index and also keys its rows by index.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: website

## Async/Workers & Performance

### Anything slower than ~15 seconds runs in a worker with a pollable job record — never in a synchronous request

**Do:** create the `DelayedJob` row in the controller before dispatch (so the client can poll immediately) and do the actual work in a queued job. **Don't:** raise `max_execution_time`/timeouts to force a slow endpoint to "work" synchronously, and don't create the job record inside the worker's `handle()` — that's a race that can 404 the client's first poll.

- Evidence: "Anything longer than about 15 seconds should not be handled in a synchronous API action." — https://github.com/wri/wri-terramatch-api/pull/343#discussion_r1675037803
- Evidence: "the Delayed job should be created when this Job is created, not when it gets started on the worker box in `handle`... the way this is set up now, it's creating a race condition that could cause a 404" — https://github.com/wri/wri-terramatch-api/pull/500#discussion_r1794169310
- Applies to: microservices, legacy-api
- Frequency: ~10

### Render user-entered text as text; sanitize real HTML with DOMPurify

**Do:** Render plain-text values as text and keep line breaks with CSS (`white-space: pre-line`). When content really is HTML (admin rich text), pass it through `DOMPurify.sanitize` — `isomorphic-dompurify` is already a dependency — before `dangerouslySetInnerHTML`. **Don't:** Replace `\n` with `<br />` and inject the result, or pass API values straight into `dangerouslySetInnerHTML`.
React escapes text by default; `dangerouslySetInnerHTML` turns that off, so any unsanitized value becomes a cross-site scripting risk.

- Source: React — dangerouslySetInnerHTML — https://react.dev/reference/react-dom/components/common ; OWASP — Cross Site Scripting Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- TerraMatch today: 13 `dangerouslySetInnerHTML` call sites; only the 2 confirm pages sanitize with DOMPurify. microservices has no HTML sanitizer, so the website is the last line of defense.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: website

### Key lists by a stable id, never by array index

**Do:** Use the item's `uuid` (or another stable id) as `key`. Keep the index only for static lists that never reorder, filter, insert or remove items. **Don't:** Use `key={index}` on lists users can edit, filter or sort.
React matches component state to keys. When an item is removed, index keys shift and state such as input values or open menus moves to the wrong row.

- Source: React — Rendering Lists (keys) — https://react.dev/learn/rendering-lists
- TerraMatch today: 54 index-style keys in the website. Example: `DisturbanceAffectedSites.tsx` removes sites by index and also keys its rows by index.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: website

### Content images use next/image with explicit dimensions

**Do:** Render uploaded media (S3 photos, thumbnails, covers) with `next/image`, giving `width` and `height`, or `fill` inside a sized container; mark only the above-the-fold hero as `priority`. **Don't:** Use a raw `<img>` without dimensions for remote photos.
`next/image` lazy-loads, serves resized modern formats and reserves space so the layout doesn't jump (CLS). `next.config.js` already allows the S3 domain.

- Source: Next.js — Image component (Pages Router) — https://nextjs.org/docs/pages/api-reference/components/image ; web.dev — Optimize Cumulative Layout Shift — https://web.dev/articles/optimize-cls
- TerraMatch today: 28 raw `<img>` tags in non-story components, several rendering S3 media such as `coverImage?.thumbUrl` and `item.thumbnail`; `next/image` is used in 9 files.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: website

### Parallelize independent async work with `Promise.all`; never drop an `await`, never `forEach(async ...)`

**Do:** collect promises and `await Promise.all(...)` when loop iterations don't depend on each other. **Don't:** call `.forEach(async fn)` expecting it to wait (it doesn't — the outer function returns before the work finishes), and don't fire an async call without `await`ing it or explicitly handling it.

- Evidence: "This needs to be wrapped in Promise.all and use map. As written, the return below is happening before the deletes have had a chance to finish." — https://github.com/wri/terramatch-microservices/pull/371#discussion_r2493058536
- Applies to: both, legacy-api
- Frequency: ~15

### Only mark a function `async` when it `await`s something; prefer `async`/`await` over `.then` chains

**Do:** use `await` sequentially inside an `async` function instead of chaining `.then()`; drop the `async` keyword from a function that only returns another promise or has no `await` in it. **Prefer (🎨, not blocking):** when two independent calls are both cheap, two plain `await`s read a little better than wrapping them in `Promise.all` for no real parallelism benefit.

- Evidence (🎨 readability preference): "🎨 I don't think there's a strong case to be made here for doing these in parallel. I would improve readability a little by breaking this into two await calls instead of wrapping in `Promise.all`" — https://github.com/wri/terramatch-microservices/pull/201#discussion_r2183225426
- Applies to: both
- Frequency: ~12

### Commit or clean up a transaction/resource in `finally` — never duplicated across every return path

**Do:** put `Redis::del`/transaction commit logic in a single `finally` block after the `try`/`catch`. **Don't:** repeat cleanup in both the success and error paths, and don't reference a variable in `catch` that the `try` may have failed to assign.

- Evidence: "a slightly cleaner way to handle this would be to move the `Redis::del` to a `finally` block and leave it out of both the `try` and `catch`." — https://github.com/wri/wri-terramatch-api/pull/500#discussion_r1817111316
- Applies to: both, legacy-api
- Frequency: ~6

### Scheduled jobs run on exactly one node when duplicate execution would be harmful — and no locks otherwise

**Do:** use the shared-cache-backed single-node mechanism (Redis + `onOneServer()`/equivalent) for jobs whose duplicate execution is harmful (digest emails, reports); leave idempotent cleanup jobs without extra locking. **Don't:** specify an explicit cron timezone without a reason (UTC by default).

- Evidence: "Switching to the redis cache is necessary for using the `->onOneServer()` functionality in Kernel.php... the task was running on all four of our production nodes" — https://github.com/wri/wri-terramatch-api/pull/366#discussion_r1690558161
- Evidence: "these don't need locks - there's no downside risk to them accidentally running too often." — https://github.com/wri/terramatch-microservices/pull/664#discussion_r3042690990
- Applies to: microservices, legacy-api
- Frequency: ~8

### Send email through the async queue pattern — never synchronously from a request

**Do:** define each email as a class (`EmailSender` subclass) and dispatch with `sendLater(queue)` for type-safe parameters. **Don't:** call a mail-send function directly inside a request-handling service, and watch outbound volume — group recipients (e.g. by locale) rather than fan out per-user sends that could spike provider rate limits.

- Evidence: "Please don't send emails directly from the service. Use the send later pattern: * Create a subclass of `EmailSender` * Use the email queue to [sendLater]..." — https://github.com/wri/terramatch-microservices/pull/534#discussion_r2805175168
- Evidence: "This is going to result in a huge volume of email. I would be shocked if we don't get API errors from Amazon and likely need to space these sends out in delayed chunks" — https://github.com/wri/wri-terramatch-api/pull/466#discussion_r1767055978
- Applies to: microservices, legacy-api
- Frequency: ~8

### Treat compute instances as ephemeral — long-lived files always go to S3, never local disk

**Do:** stream exports/uploads directly to S3. **Don't:** write anything that must persist or be read by another process to local disk — web and worker boxes are separate machines and don't share a filesystem.

- Evidence: "We don't store files on the local file system in v3... Exports get sent to S3" — https://github.com/wri/terramatch-microservices/pull/664#discussion_r3042713374
- Evidence: "Remember that in AWS, the workers and the web boxes are separate EC2 machines and do not share a file system." — https://github.com/wri/wri-terramatch-api/pull/500#discussion_r1794164719
- Applies to: microservices, legacy-api
- Frequency: ~8

### Scheduled report generation is a job on one cadence — not an endpoint side effect

**Do:** generate financial / SRP reports from the scheduled-job path (`dueDateTime` / annual rules), and keep reminder email on `EmailSender.sendLater`. **Don't:** create the next report inline in a random entity update, or send those mails synchronously.

- Evidence: financial report generation — https://github.com/wri/terramatch-microservices/pull/841 ; SRP generation — https://github.com/wri/terramatch-microservices/pull/409 ; annual due-date validation — https://github.com/wri/terramatch-microservices/pull/430 ; financial-report mails — https://github.com/wri/terramatch-microservices/pull/293 ; PPC regeneration date — https://github.com/wri/terramatch-microservices/pull/847
- Applies to: microservices
- Priority: mandatory

---

## Security & Authorization

### Services shut down gracefully

**Do:** Call `app.enableShutdownHooks()` in every `main.ts`, so SIGTERM runs Nest's shutdown hooks: BullMQ workers close cleanly and connections are released. **Don't:** Rely on the process being killed, or close resources only in the HMR `dispose` handler.
ECS sends SIGTERM on every deploy and scale-in. Without hooks, active jobs are cut off and only resume as stalled jobs about 30 seconds later, and partial work may run twice.

- Source: NestJS — Lifecycle events (Application shutdown) — https://docs.nestjs.com/fundamentals/lifecycle-events ; BullMQ — Going to production (graceful shutdown) — https://docs.bullmq.io/guide/going-to-production
- TerraMatch today: none of the six `main.ts` files calls `enableShutdownHooks()`; `app.close()` only runs in the HMR `dispose` handler. Services run as ECS Fargate tasks (`cdk/service-stack`), and `@nestjs/bullmq` closes its workers in `onApplicationShutdown`.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: microservices

### Authorize via permission-based policies on every endpoint — never role checks, never ad hoc, never in a controller

**Do:** declare a `*Policy extends UserPermissionsPolicy` per resource that checks `permissions.includes(...)`, and call `policyService.authorize(action, model)` from both index and single-GET paths, authorizing the specific instance where possible. **Don't:** check role names directly (it "caused a big mess in the PHP codebase"), inspect `permissions` inline in a controller, or grant a blanket `can(["read","delete"], Model)` to any authenticated user.

- Evidence: "we should _never_ be relying directly on roles. It's caused a big mess in the PHP codebase ... Roles are only used for distributing permissions - the permissions control what a user can do." — https://github.com/wri/terramatch-microservices/pull/114#discussion_r2023202009
- Evidence: "Controllers should never depend directly on permissions - it's the job of the policies to convert permissions into permissible actions." — https://github.com/wri/terramatch-microservices/pull/371#discussion_r2488181517
- Applies to: microservices, legacy-api
- Frequency: ~45

### Services shut down gracefully

**Do:** Call `app.enableShutdownHooks()` in every `main.ts`, so SIGTERM runs Nest's shutdown hooks: BullMQ workers close cleanly and connections are released. **Don't:** Rely on the process being killed, or close resources only in the HMR `dispose` handler.
ECS sends SIGTERM on every deploy and scale-in. Without hooks, active jobs are cut off and only resume as stalled jobs about 30 seconds later, and partial work may run twice.

- Source: NestJS — Lifecycle events (Application shutdown) — https://docs.nestjs.com/fundamentals/lifecycle-events ; BullMQ — Going to production (graceful shutdown) — https://docs.bullmq.io/guide/going-to-production
- TerraMatch today: none of the six `main.ts` files calls `enableShutdownHooks()`; `app.close()` only runs in the HMR `dispose` handler. Services run as ECS Fargate tasks (`cdk/service-stack`), and `@nestjs/bullmq` closes its workers in `onApplicationShutdown`.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: microservices

### Every outbound HTTP call has a timeout

**Do:** Pass `signal: AbortSignal.timeout(ms)` to `fetch` — `gwc-tile-invalidation.service.ts` already does this with an `AbortController` — sized to the caller: short in request paths, longer in queue jobs. **Don't:** Call external APIs (Global Forest Watch, Transifex, analytics, notifications) without a deadline.
Node's `fetch` waits up to 300 s for response headers and 300 s between body chunks by default, so a slow upstream can hold a request or a worker for minutes.

- Source: AWS Builders' Library — Timeouts, retries and backoff with jitter — https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ ; undici — Client options (default timeouts) — https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md
- TerraMatch today: 10 of 11 `fetch` calls in `libs/` set no timeout (data-api, transifex-api, analytics events, Greenhouse notifications, media).
- Origin: team proposal (external reference), not from the review corpus
- Applies to: microservices

### Bound database fan-out and group writes

**Do:** Group writes that share values into one statement per distinct value (`Model.update(values, { where: { id: ids } })`), and cap concurrency when mapping over lists that can grow (chunk them, or reuse `batchFindAll`). **Don't:** Run `Promise.all(list.map(item => Model.update(...)))` over a list with no upper bound.
Without an explicit `pool` setting, Sequelize uses at most 5 connections and waits up to 60 s to acquire one, so a large fan-out queues behind the pool and starves other requests.

- Source: Sequelize — Connection Pool — https://sequelize.org/docs/v6/other-topics/connection-pool/
- TerraMatch today: no `pool` is configured, so the defaults apply (max 5, acquire 60 s). `validation.service.ts` updates polygons with one statement per polygon inside `Promise.all`; grouping by `validationStatus` needs one statement per status. This extends the guide's bulk-write rule with the pool limit.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: microservices

### `permissions.ts`/the permissions config is the single source of truth — services never create or mutate permissions at runtime

**Do:** add a new permission to the config file, then run the established sync process (`Permission.syncPermissions()`). **Don't:** write service code that creates, deletes, or otherwise manages permission records.

- Evidence: "the current process has been to update the permissions in `permissions.ts` (which should be considered the source of truth), and then run `await Permission.syncPermissions()` in the REPL." — https://github.com/wri/terramatch-microservices/pull/567#discussion_r2843773463
- Applies to: microservices
- Frequency: ~5

### In an authenticated endpoint, the user id is guaranteed — narrow it, don't re-guard it

**Do:** cast with `as number` (or use `UserContext.authenticatedUserId`). **Don't:** write `if (userId == null) throw` on an endpoint that doesn't opt out of auth — the guard already ran; that branch is dead code.

- Evidence: "For a normal endpoint (one that doesn't opt out of auth), the user id is guaranteed to be non null" — https://github.com/wri/terramatch-microservices/pull/464#discussion_r2641585908
- Applies to: microservices
- Frequency: ~10

### Explicitly opt out of auth (`@NoBearerAuth`) for intentionally-unauthenticated endpoints, and set up context by hand

**Do:** decorate genuinely public endpoints with `@NoBearerAuth` and, if a JWT is optionally present, parse it and set the user context before calling into policy checks. Password reset in particular must never be policy-gated — it's inherently unauthenticated. **Don't:** invent a bespoke "mode" flag when a normal filter param already expresses the intent.

- Evidence: "You'll need to add the `@NoBearerAuth` decorator to your endpoint, and handle looking for the JWT token and setting it on the request context if it exists before calling the policy service" — https://github.com/wri/terramatch-microservices/pull/557#discussion_r2831220357
- Applies to: microservices
- Frequency: ~8

### API responses send security headers

**Do:** Register `helmet()` in every `main.ts` (or once in a shared bootstrap helper) and send `Cache-Control: no-store` on authenticated responses, as OWASP recommends for REST APIs. Check that the Swagger documentation page still loads afterwards. **Don't:** Rely on API Gateway for these headers: the current stack doesn't add any.
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff` and `frame-ancestors 'none'` block HTTPS downgrade, MIME sniffing and framing for any browser that reads the API.

- Source: OWASP — REST Security Cheat Sheet (Security Headers) — https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html ; NestJS — Helmet — https://docs.nestjs.com/security/helmet
- TerraMatch today: `helmet` isn't a dependency, none of the six `main.ts` files sets security headers, and the API Gateway stack (`cdk/api-gateway`) doesn't add them either.
- Origin: team proposal (external reference), not from the review corpus
- Applies to: microservices

### Configuration and secrets come from the config service or a secrets manager — never `process.env` directly, never hardcoded

**Do:** read configuration through `ConfigService`; keep API tokens/passwords in GitHub secrets or AWS Secrets Manager, copied explicitly at deploy time. **Don't:** read `process.env` inside a service, or commit a secret (even a placeholder) to source.

- Evidence: "This needs to be retrieved from the config service. `process.env` is not how we get configuration in these services." — https://github.com/wri/terramatch-microservices/pull/664#discussion_r3042699884
- Evidence: "If there is some value to including it, it should be from the environment (and be a random string), not included in our publicly accessible codebase." — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925827984
- Applies to: microservices
- Frequency: ~10

### Escape/parameterize all raw SQL input; guard the DB connection with a throwing accessor

**Do:** always escape through the framework's own mechanism before interpolating a user-controlled value into raw SQL; add a `get sql()` accessor that throws `InternalServerErrorException` if the connection is unexpectedly missing, rather than silently falling back to unescaped input. **Don't:** default to sending unescaped values to the DB "just in case" the safe path fails.

- Evidence: "having the default be to just go ahead and wrap the cohort and send it to the DB opens us up to an injection attack vector, so definitely need to avoid that." — https://github.com/wri/terramatch-microservices/pull/218#discussion_r2176151736
- Applies to: microservices
- Frequency: ~5

### Scope authorization grants as tightly as the use case allows

**Do:** restrict update/delete to ownership (`createdBy`), a specific framework, or a specific instance — narrow the policy check rather than reusing a broader permission (a delete-one endpoint shouldn't require a delete-all permission). **Don't:** let any authenticated user read or delete every record of a sensitive type in the DB.

- Evidence: "allowing any authenticated user to read and delete every financial report in the DB is very dangerous." — https://github.com/wri/terramatch-microservices/pull/276#discussion_r2294244751
- Applies to: microservices
- Frequency: ~10

---

## Git/PR Hygiene & Process

## Testing, QA & Change Safety (team proposal)

> Not from the review corpus: each rule cites an external reference and what the code shows today (verified 2026-09-18 against `wri-terramatch-website@836865ea6` and `terramatch-microservices@9fa3129e`).

### Every fix ships with a test that fails without it

**Do:** Reproduce the bug in a test first, confirm it fails, then fix it and keep the test as a regression guard. **Don't:** Merge a fix whose only proof is a manual check or a coverage number.
A test that never failed proves nothing. Reviewers should be able to answer: will this test fail when the code is broken?

- Source: Google Engineering Practices — What to look for in a code review — https://google.github.io/eng-practices/review/reviewer/looking-for.html
- TerraMatch today: microservices enforces 95% line coverage globally (`jest.preset.js`), but coverage alone doesn't show that a specific bug is guarded.
- Applies to: both

### Test behavior through public surfaces, not implementation details

**Do:** Assert on HTTP responses, returned DTOs and resulting database rows; build data with the existing factories against the test MariaDB. **Don't:** Assert that a private method or a Sequelize call was invoked, or mock the model under test.
Tests coupled to implementation break on every refactor without catching real bugs.

- Source: Google Testing Blog — Test Behavior, Not Implementation — https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html ; Google Testing Blog — Change-Detector Tests Considered Harmful — https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html
- TerraMatch today: 116 of 226 microservices specs already use factories with the real test database; 28 use `jest.mock`. This rule codifies the dominant pattern.
- Applies to: both

### Every endpoint tests its deny path

**Do:** For each new or changed endpoint, add a case where a user without the permission, or from another organisation, gets 401/403, next to the allowed case. Cover allow and deny for each new policy action. **Don't:** Test only the happy path of an authorized user.
Broken Object Level Authorization has been OWASP's top API risk since 2019, and it only shows up when a test uses the wrong user.

- Source: OWASP API Security Top 10 2023 — API1 Broken Object Level Authorization — https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- TerraMatch today: 28 policy specs for 32 policies, but only 19 of 43 controller specs assert an Unauthorized or Forbidden response.
- Applies to: microservices

### Frontend tests interact like a user

**Do:** Query with `screen.getByRole` or `getByLabelText`, drive interactions with `@testing-library/user-event`, and assert what the user sees. **Don't:** Use `getByTestId` when an accessible query works, or snapshot large component trees.
If `getByRole` can't find a control, a screen-reader user can't either, so each test doubles as an accessibility check.

- Source: Testing Library — Guiding Principles — https://testing-library.com/docs/guiding-principles/ ; Kent C. Dodds — Common mistakes with React Testing Library — https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- TerraMatch today: the website has 28 test files but only 3 component tests (12 are option snapshots), `@testing-library/user-event` isn't installed, and global coverage thresholds are 14/9/6/15%.
- Applies to: website

### Tests are deterministic

**Do:** Freeze time with Jest fake timers or fixed dates, seed `faker` (or use fixed values where the value matters), stub external services such as S3, Global Forest Watch and Transifex, and let each test create its own data. **Don't:** Depend on the real clock, unseeded random data, network access or test order.
Flaky tests teach the team to ignore a red CI. Google reported that about 16% of its tests showed some flakiness.

- Source: Google Testing Blog — Flaky Tests at Google and How We Mitigate Them — https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
- TerraMatch today: 21 microservices spec files build dates from the real clock, only 1 uses fake timers, and `faker` is never seeded, so a failure caused by random data can't be reproduced.
- Applies to: both

### API changes stay backward compatible across deploys

**Do:** Make contract changes additive. For renames or removals use expand → migrate → contract: add the new field, move the website to it, then remove the old one in a later release. **Don't:** Rename or remove a DTO field, endpoint or enum value in the same release that the website starts depending on the change.
The website and the services deploy independently, so for a while an older client talks to a newer API, and the reverse.

- Source: martinfowler.com — Parallel Change — https://martinfowler.com/bliki/ParallelChange.html ; oasdiff — breaking-change GitHub Action — https://github.com/oasdiff/oasdiff-action
- TerraMatch today: the website's `build` script regenerates the v3 clients from Swagger (`yarn generate:services && next build`), and no CI step flags breaking OpenAPI changes. Proposal: add the oasdiff breaking-change check to microservices PRs.
- Applies to: microservices (contract), website (consumer)

### Schema changes are split across releases

**Do:** Add columns as nullable or with a default, backfill with a REPL one-off, switch the code, then drop or rename the old column in a later migration. **Don't:** Rename, drop or retype a column that deployed code still reads, in the same release.
Code and schema never change at the same instant, so each step must work with both the old and the new shape.

- Source: martinfowler.com — Parallel Change — https://martinfowler.com/bliki/ParallelChange.html
- TerraMatch today: `deploy-services.yml` runs migrations as a separate job after `user-service` deploys, and `run-migrations.yml` can also run on its own.
- Applies to: microservices

### Queue jobs are idempotent, and retries are a deliberate choice

**Do:** Make running a job twice safe (check state before writing, upsert instead of insert). Set `attempts` and `backoff` explicitly for jobs that call S3 or external APIs. Pass a deterministic `jobId` when the same job must not run twice at once. **Don't:** Swallow errors in a processor: BullMQ then marks the job as completed and never retries it.
Workers restart and deploys interrupt jobs, so a job can run more than once.

- Source: BullMQ — Idempotent jobs — https://docs.bullmq.io/patterns/idempotent-jobs ; BullMQ — Retrying failing jobs — https://docs.bullmq.io/guide/retrying-failing-jobs ; BullMQ — Deduplication — https://docs.bullmq.io/guide/jobs/deduplication
- TerraMatch today: processors already rethrow through `DelayedJobException`. None of the 31 `queue.add` calls sets a `jobId`, and no queue sets `attempts`, so a transient failure is never retried.
- Applies to: microservices

### Map request attributes explicitly; never spread them into a model

**Do:** Copy only the fields a client may set, as `MediaService.createMedia` does with `isPublic`, `isCover`, `lat` and `lng`. **Don't:** Pass `...payload.data.attributes` into `Model.create` or `update`, where a client could set fields it doesn't own (status, ownership, flags).
OWASP groups this under Broken Object Property Level Authorization, formerly called mass assignment.

- Source: OWASP API Security Top 10 2023 — API3 Broken Object Property Level Authorization — https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ ; NestJS — Validation — https://docs.nestjs.com/techniques/validation
- TerraMatch today: the create paths reviewed already map explicit fields, but none of the six services configures `ValidationPipe` with `whitelist: true`, so undeclared properties reach controllers. Proposal: enable `whitelist: true` after testing nested JSON:API bodies, then consider `forbidNonWhitelisted`.
- Applies to: microservices

### Keep branches current with the base branch — never silently revert already-merged work

**Do:** regularly merge/rebase from `staging` (or the target release branch) so the diff reflects only your own change and the deploy pipeline (which regenerates API definitions from the base branch) doesn't break. **Don't:** let a long-lived branch drift so far that its diff shows removal of code someone else has since shipped.

- Evidence: "This change is reverting some recent work on `staging`. Please update your branch from `staging` to avoid that." — https://github.com/wri/wri-terramatch-api/pull/240#discussion_r1619598422
- Evidence: "It would be a good idea to update your epic branch from `staging` ... when vercel deploys, it refreshes its API definitions from staging as part of the build process." — https://github.com/wri/wri-terramatch-website/pull/180#issuecomment-2113352149
- Applies to: both, legacy-api
- Frequency: ~30

### A PR's diff contains only what its ticket requires — no unrelated changes, no drive-by fixes

**Do:** cut a clean branch from the base (or merge the base in and manually roll back anything unrelated) so the reviewable diff is scoped to the ticket. **Don't:** bundle an unrelated config flip, dependency downgrade, role rename, or "while I was in there" refactor into a feature PR without calling it out explicitly.

- Evidence: "I'm finding that your PRs for this ticket have a lot of changes in them that are not related to your work ... I'd like to see them either a) cut with new branches from staging that only include your changes, or b) merge staging in and make sure that the resulting diff only includes your changes." — https://github.com/wri/wri-terramatch-website/pull/1748#discussion_r2730233662
- Applies to: both, legacy-api
- Frequency: ~20

### Address or explicitly respond to every review comment before re-requesting review

**Do:** either fix what was flagged or explain why not, on every comment, before pinging for re-review. **Don't:** leave prior feedback silently unaddressed — he re-checks on every subsequent push and will call out anything still outstanding.

- Evidence: "Looks like none of my comments from the previous review have been addressed or responded to?" — https://github.com/wri/wri-terramatch-website/pull/2030#issuecomment-4052202805
- Evidence: "Still needs to be addressed." — https://github.com/wri/wri-terramatch-website/pull/2344#discussion_r3220091876
- Applies to: both, legacy-api
- Frequency: ~25

### Build, lint, tests, and coverage must be green before merge — never lower a threshold to get there

**Do:** run the full build/test suite locally before requesting review; restore any coverage threshold you had to temporarily drop, back to its original value. **Don't:** merge with a known failing test/build, and don't treat a coverage threshold as negotiable.

- Evidence: "We'll want this back to normal before the final merge." (coverage threshold) — https://github.com/wri/terramatch-microservices/pull/64#discussion_r1975801611
- Evidence: "The tests are failing; please investigate after addressing the feedback." — https://github.com/wri/wri-terramatch-website/pull/240#issuecomment-2155211169
- Applies to: both, legacy-api
- Frequency: ~25
- Tooling: website `package.json` has `test:ci`; `.husky/pre-commit` runs `lint-staged`/prettier in all three repos.

### Put the ticket number in the PR title and, ideally, the branch name

**Do:** follow `type/TM-####-description` for branch names, and ensure the ticket number appears in the PR title regardless, so it lands in git history on merge.

- Evidence: "I won't require changing the branch name ... but do please add the ticket number to the PR title so it shows up in the git history when the branch is merged." — https://github.com/wri/wri-terramatch-website/pull/114#issuecomment-2049911275
- Applies to: both
- Frequency: ~5

### `package.json` changes ship with the matching lockfile; a major version bump gets its own ticket

**Do:** commit the updated `yarn.lock`/`package-lock.json` alongside any dependency change; treat a major-version bump as a separate, deliberately-scoped piece of work with its own investigation. **Don't:** let a dependency change land without its lockfile, or bundle a risky major bump into an unrelated feature PR.

- Evidence: "Changes to the package.json should have an accompanying change to the `yarn.lock`" — https://github.com/wri/wri-terramatch-website/pull/120#discussion_r1571251716
- Applies to: website, microservices
- Frequency: ~8

### Never merge mocked data, debug logging, or commented-out code into a shared branch

**Do:** strip these before merge, without exception. **Don't:** treat this as optional cleanup for "later" — see also the Simplicity/Dead-Code section for the general form of this rule.

- Evidence: "Please remove all placeholder / mocked data before merging to staging." — https://github.com/wri/wri-terramatch-website/pull/253#discussion_r1637114525
- Applies to: both, legacy-api
- Frequency: (see Simplicity section; this is the PR-gating restatement of the same rule)

### Ask for help rather than spending hours stuck

**Do:** flag the tech lead when a problem is taking hours to track down. **Don't:** silently burn a day on something a five-minute conversation could resolve — he offers help proactively for exactly this reason.

- Evidence: "Please in the future, if you're needing to spend hours trying to track something like this down, pull me in. That definitely is a case of spending too long trying to figure something out without asking for help." — https://github.com/wri/wri-terramatch-website/pull/1232#discussion_r2110437616
- Applies to: both
- Frequency: ~4

### Stack dependent PRs on their prerequisite's branch; merge base-first

**Do:** base a second PR on the first's branch when they share code, so it's reviewed once, and merge the base PR before the dependent one. **Don't:** let a diff balloon because a stacked PR was based on `main` instead of its actual dependency.

- Evidence: "let's make sure that #244 is merged before this one because this is based on its branch and I'd like to avoid the situation of the 3k lines of diff showing up on the other PR" — https://github.com/wri/wri-terramatch-website/pull/248#issuecomment-2158948702
- Applies to: both, legacy-api
- Frequency: ~6

---

## Formatting

### Leave a blank line between every class member — methods, fields, decorators, and type/interface declarations

**Do:** put one empty line above every method, field, class, type, interface, and class-level decorator (except the very first member after the opening brace). **Don't:** stack declarations with no visual separation.

- Evidence: "Please keep empty newlines between logical blocks to make it easier to visually parse a TS file. In general, I keep an empty line above all class, type (and interface), and method declarations." — https://github.com/wri/terramatch-microservices/pull/122#discussion_r2053072330
- Applies to: both
- Frequency: ~25

### Run the repo's prettier config on save (or via pre-commit) — formatting is not a matter of taste

**Do:** configure the editor to format on save so PRs never show prettier-only diffs (spacing inside braces, class-order churn, quote style). **Don't:** manually fight the formatter's opinions or leave prettier violations for the reviewer to flag one by one.

- Evidence: "I recommend setting up your editor to use our prettier config on save ... the lack of spaces inside the curly brace (`{where` vs `{ where`)" — https://github.com/wri/terramatch-microservices/pull/46#discussion_r1925829241
- Applies to: both
- Frequency: ~15
- Tooling: all three repos run `prettier --write` via `.husky/pre-commit` + `lint-staged`; shared `.prettierrc` settings across website/microservices: `printWidth: 120`, `semi: true`, `singleQuote: false`, `trailingComma: "none"`, `arrowParens: "avoid"`.

### Use `const` for anything never reassigned, declared in the narrowest scope that needs it

**Do:** declare a value `const` right where it's used (e.g. inside the `try` block that's its only consumer), and avoid hoisting a `let` above branches when each branch can declare its own `const`. **Don't:** default to `let` out of habit.

- Evidence: "This never gets reassigned; please use `const`" — https://github.com/wri/wri-terramatch-website/pull/164#discussion_r1624993722
- Evidence: "I try to avoid mutability when possible. ... Use `const result = ` in each of the `if` blocks below instead." — https://github.com/wri/terramatch-microservices/pull/170#discussion_r2101582953
- Applies to: both
- Frequency: ~10

### Keep string literals as plain, single-line strings — no needless template literals, no split class strings

**Do:** use `"..."` for a string with no interpolation, and keep a Tailwind/class string on one line. **Don't:** wrap a plain string in backticks for no reason, or split a class string across lines inside a template literal.

- Evidence: "There doesn't appear to be any need for an interpolation string on these two, please use `\"` instead." — https://github.com/wri/wri-terramatch-website/pull/176#discussion_r1605380038
- Applies to: website
- Frequency: ~5

### One import per module — never import the same thing twice under different names

**Do:** check for an existing import before adding an alias. **Don't:** alias a module that's already imported under its real name.

- Evidence: "This is already imported as `twMerge` on the line below; let's not import it twice." — https://github.com/wri/wri-terramatch-website/pull/173#discussion_r1605343961
- Applies to: website
- Frequency: ~2
- Tooling: website `.eslintrc.js` enables `simple-import-sort/imports: "error"`.

---

## Legacy monolith (`wri-terramatch-api`) — deprecated, principles that transfer

`wri-terramatch-api` is the legacy PHP/Laravel monolith being actively deprecated in favor of `terramatch-microservices`. **New backend work goes to v3, not here** — Nathan has closed PRs outright when they touched a system (e.g. forms) already ported to v3. The items below are either (a) Laravel/Eloquent-specific mechanics with no direct equivalent in the TypeScript codebases, kept here for reference only, or (b) general principles that happened to be observed in this repo and are cross-referenced to their general form above.

- **New one-off commands and any forms-related work belong in v3, not the legacy API.** "please remember going forward: all one off commands that don't require a file for import should be implemented in v3." — https://github.com/wri/wri-terramatch-api/pull/1233#discussion_r2730273897
- **Explicit `== null` and non-redundant `?->` — the top null-handling principle, in PHP.** Use `$x == null` (not implicit truthiness), and drop `?->` / `?? null` where the value is already guaranteed non-null. This is the same rule as the main Null-Handling section, observed sharply in the legacy repo (PR #240 alone has five near-identical corrections). "Project is guaranteed not to be null here, so please use `$project->` instead of `$project?->`" — https://github.com/wri/wri-terramatch-api/pull/240#discussion_r1626446756 ; "`uuid` is guaranteed not to be null based on the `first()` above, so this can simply be `if ($firstRecord == null) { return null; }`" — https://github.com/wri/wri-terramatch-api/pull/1021#discussion_r2322961481
- **Let framework traits (`HasUuid`, `HasTimestamps`) generate UUIDs/timestamps — never set them by hand.** Generalizes to: use the ORM's auto-managed columns everywhere (§ Data Layer). "UUID shouldn't be handled at the controller level, and neither should timestamps." — https://github.com/wri/wri-terramatch-api/pull/145#discussion_r1566522951
- **Lean on Eloquent relationships and scopes instead of `DB::table`/raw SQL.** Generalizes to: use the ORM's relations, not raw table access (§ Data Layer). "Please lean into the Laravel associations as much as possible." — https://github.com/wri/wri-terramatch-api/pull/275#discussion_r1635485631
- **Resource classes exist only to transform data — delete a `JsonResource` that's a pure pass-through, and put all field mapping in `toArray`.** Generalizes to: the DTO/serializer layer does the shaping, controllers don't (§ Architecture, § DTOs). "A Resource class that doesn't do anything other than return the value passed into it can be removed" — https://github.com/wri/wri-terramatch-api/pull/237#discussion_r1626616686
- **Use route-model binding and `ModelBindingInterfaceMiddleware`; resolve the entity type/ID at the routing layer, never via a hand-rolled `getEntityFromRequest` helper.** Generalizes to: type the controller signature, resolve entities before the handler body runs. "I don't think the `getModelInstance()` method should be needed at all; avoiding methods like that is the whole purpose of the ModelBindingInterfaceMiddleware" — https://github.com/wri/wri-terramatch-api/pull/308#discussion_r1655559125
- **Respect the state machine exclusively — never assign `status` directly; subclasses extend `parent::transitions()`, never replace it.** No direct v3 equivalent yet documented, but the underlying principle — mutate state only through the API designed to enforce transitions — is general. "the status should never be updated directly. Instead, it should be updated with `$site->status()->transitionTo()`" — https://github.com/wri/wri-terramatch-api/pull/324#discussion_r1662880517
- **Schema conventions: booleans as boolean columns (never `1`/`0`), foreign keys instead of name strings, indexes on lookup columns, avoid DB `enum` (use varchar), JSON columns nullable, sensible column defaults.** Directly mirrored in the microservices Data Layer guidance above. "`enum` isn't really recommended for typical DB usage because it's hard to modify or remove values without data loss. This can be a simple string." — https://github.com/wri/wri-terramatch-api/pull/500#discussion_r1794174697 (both enum comments are in the legacy api repo; the varchar-over-enum principle carries into microservices schema work)
- **Never wrap model attributes in getter/setter methods (`getStatus()`/`setStatus()`) — use attribute accessors and `update()`.** Laravel-specific syntax; the transferable idea is "use the ORM's idiomatic access patterns, don't wrap them." "This is a non-idiomatic way to handle attributes in laravel. The code ... should just call `$delayedJob->status` directly, and `$delayedJob->update(['status' => $status])`" — https://github.com/wri/wri-terramatch-api/pull/500#discussion_r1794172813
- **Treat EC2 disks as ephemeral; long-lived files go to S3.** Restated identically in microservices (§ Async/Workers).
- **OpenAPI docs are generated from `openapi-src` — never hand-edit the built `swagger-v2.yml`.** Legacy build-tooling detail; the transferable idea is "keep generated API docs generated, edit the source."
- **`make lint-fix` / `make doc` before requesting review.** Legacy Makefile commands; the transferable idea is "run the repo's lint/format/doc tooling before asking for review" (§ Git/PR Hygiene). "Looks like the linter found a failure. You should be able to fix automatically with `make lint-fix`" — https://github.com/wri/wri-terramatch-api/pull/816#issuecomment-2811026056
- **One-off scripts live in `Commands/OneOff` with a `one-off:` prefix and are held to a lighter maintainability bar** — Nathan explicitly does not insist on clean code in a script that runs exactly once, though he still insists on correctness (verified against real prod data, not hardcoded/guessed UUIDs). This calibration (relaxed style bar, fixed correctness bar) is general and applies to genuine one-off scripts in the active repos too. "I typically don't get fussy over the formatting, readability or maintainability of one-off scripts. They don't need to be maintainable, they only get run once... In this particular case, I tested the heck out of this code myself" — https://github.com/wri/wri-terramatch-api/pull/834#discussion_r2068945008
- **Migrations are schema-only, never data changes; never edit an already-applied migration.** Restated identically in microservices (§ Data Layer).
- **Foreign keys reference the integer `id`, tables are named in the plural.** Restated identically for new microservices tables. "This is for a foreign key, I assume? Let's use ID instead of UUID." / "Please make the table name plural. Most of our tables are that way." — https://github.com/wri/wri-terramatch-api/pull/1275#discussion_r2990205459 , https://github.com/wri/wri-terramatch-api/pull/1275#discussion_r2990202395

---

## Weaker signals / individual preferences

These are real, quoted preferences of Nathan's, but either lower-frequency, explicitly framed by him as optional/non-blocking, or narrower in scope than the rules above. Treat them as tie-breakers, not blockers, and revisit in the adversarial pass.

- **Prefer `undefined` over `null` for "absent" values the code itself produces** (as opposed to values that come from the DB, where `null` is standard). He frames this as "trying to be a little better about that myself," not an established rule. — https://github.com/wri/terramatch-microservices/pull/164#discussion_r2109833821
- **🎨 / `:art:` marks a suggested simplification that is explicitly not required for approval** — e.g. inlining single-statement functions, preferring `for` over `.map()` when not chaining, one-line vs. multi-line ternary formatting. These are style nits he's comfortable merging without.
- **Prefer `type` + intersection over converting a `type` to an `interface` just to gain `extends`** — a minor preference, raised only a few times.
- **`new Media(); media.x = ...; await media.save()` vs. a single-line `Media.create()`** — he prefers whichever reads more cleanly for the specific case, explicitly declining to make this mechanical either direction.
- **Consider a state-machine or class-validator-on-model approach for new status fields** — offered as a nice-to-have suggestion ("if it turns out not to be as straightforward as I hope, leaving this as it is is totally fine"), not a mandate.
- **Naming a variable that holds cached store data (`siteIndexConnection` vs. `response`)** — a specific, thoughtful preference but raised only once; worth following but not to be treated as load-bearing outside the connection system.

---

## Components & Design System (Redesign)

_(Applies to `wri-terramatch-website` — redesign UI only.)_

### Search `src/redesignComponents` before building new UI

**Do:** check `src/redesignComponents` and the existing WRI design-system wrappers before implementing a component; reuse or compose an existing component when it already covers the required behavior. **Don't:** create a page-local duplicate, unnecessary wrapper, or parallel implementation of an established redesign component.

- Frequency: ~12

### Prefer redesign components over legacy or raw third-party UI

**Do:** use a component from `src/redesignComponents` or an established WRI design-system wrapper when building a redesign experience. **Don't:** reach directly for a legacy TerraMatch component, MUI component, or another third-party UI primitive when a redesign equivalent exists.
**Exception — No redesign equivalent.** A third-party primitive may be used inside a shared redesign component when no redesign or WRI equivalent exists. Keep the dependency encapsulated instead of importing it directly into feature pages.

- Frequency: ~5

### Put reusable redesign components in the appropriate category and add a Storybook story

**Do:** place a new reusable component in the closest existing category under `src/redesignComponents`, and add or update a colocated `*.stories.tsx` file covering its meaningful states and variants. **Don't:** create an ad hoc top-level category or ship reusable redesign UI without Storybook coverage.
**Exception — Internal helpers.** A private implementation helper does not need its own story when it is fully exercised through the public component's stories.

- Frequency: ~5

### Use Chakra primitives for layout, structure, and text

**Do:** use Chakra primitives such as `Flex`, `Box`, `Stack`, `Grid`, and `Text` when they cover the required layout or text behavior; preserve the intended HTML semantics through the `as` prop. **Don't:** add raw `div`, `section`, `span`, or `p` elements merely to apply layout or typography styles.

- Frequency: ~5

---

## Styling (Redesign)

_(Applies to `wri-terramatch-website` — redesign UI only.)_

### Style with Tailwind utilities through `className`; don't introduce another stylesheet mechanism

**Do:** use Tailwind utility classes through `className` for layout, spacing, sizing, positioning, and responsive styling; merge caller-provided classes with `twMerge` or the established local merge pattern. **Don't:** create new CSS/SCSS files, CSS Modules, `*.styles.ts` files, or styled-component/Emotion wrappers for redesign work.
**Status — existing debt.** A small number of `styled.ts`, `*.styles.ts`, and Chakra `css` overrides remain in the redesign. Treat them as legacy or library-integration exceptions, not patterns for new components.

- Frequency: ~7

### Use spacing and sizing tokens; use `rem` when an explicit length is unavoidable

**Do:** prefer the spacing and sizing scales exposed by Tailwind and Chakra; when a raw CSS length is genuinely required, express it in `rem`. **Don't:** introduce new `px` values for typography, spacing, dimensions, or responsive values.

- Frequency: ~5

### Consume colors through the shared theme token system

**Do:** use Chakra theme tokens such as `color="neutral.900"`, `bg="primary.100"`, and `borderColor="neutral.300"`; in Tailwind, use the synchronized `theme` palette such as `text-theme-neutral-900` and `bg-theme-primary-100`. **Don't:** place hex, RGB, HSL, or unapproved default Tailwind colors directly in component styling.
**Exception — Token definitions and fixed artwork.** Raw color values belong in the central theme definition or in approved fixed-color brand, logo, illustration, and shared icon assets—not in page or component styling.

### Render user-facing text through Chakra `Text` with `textStyle` and `color`

**Do:** wrap every user-facing string—including text nested inside `Flex`, `Box`, `Stack`, or `Grid`—in Chakra's `Text`; set an explicit redesign `textStyle` token and theme `color`, and use `as` when different semantic HTML is required. **Don't:** render bare text nodes or raw `p`/`span`/`div` elements as text substitutes, or recreate typography with Tailwind font-size/line-height classes, Chakra `fontSize`, or one-off CSS.

Valid typography tokens are `50`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `1000`, and `1100`, plus each token's `-bold` variant. If a genuinely new typography value is required, define it in the theme with `rem` values and consume it through `textStyle`.

```tsx
import { Text } from "@chakra-ui/react";

<Text as="p" textStyle="400" color="neutral.900">
  {t("Example text")}
</Text>;


---



```
