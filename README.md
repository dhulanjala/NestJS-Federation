# fed-refresher — Apollo Federation 2 reference build

A working, minimal Apollo Federation 2 setup: two NestJS subgraphs
(`users`, `animations`) behind an Apollo Gateway. Built as a reference to
read and run, not a tutorial to follow line-by-line — this file explains
*why* each piece exists and points at the exact file where it lives.

## Running it

```
npm install          # root — installs `concurrently`
cd users && npm install && cd ..
cd animations && npm install && cd ..
cd gateway && npm install && cd ..
npm run dev           # starts all three: 3001, 3002, 4000
```

Open `http://localhost:4000/graphql` and run:

```graphql
{
  users {
    id
    name
    animations {
      id
      title
      durationMs
    }
  }
}
```

Watch the gateway terminal while that query runs — that's the point of
this project, not just the response.

---

## 1. `@key` and entities

`users/src/user.model.ts`:

```ts
@ObjectType()
@Directive('@key(fields: "id")')
export class User { ... }
```

`@key(fields: "id")` is what turns a normal GraphQL object type into a
**federated entity** — a type whose identity (`id`) other subgraphs can
reference without owning the rest of its fields. Without `@key`, a type is
just local to one subgraph and can't be extended elsewhere.

## 2. Where `@link` shows up

Every Federation 2 subgraph schema opens with a `@link` directive pointing
at the federation spec — it's what tells the composition tool "interpret
`@key`, `@override`, etc. using v2 semantics," and which directives this
schema actually imports. Query `{ _service { sdl } }` directly against
either subgraph (bypassing the gateway) to see it:

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.14", import: ["@key", "@override", "@shareable", ...])
```

That's not something we wrote — `autoSchemaFile: { path, federation: 2 }`
in `users/src/app.module.ts` and `animations/src/app.module.ts` generates
it automatically. If you ever see a subgraph schema *without* a `@link` to
the federation spec, it's a Federation 1 (or non-federated) schema — that
distinction is a common interview question.

## 3. Why `User.animations` lives in the `animations` subgraph

`animations/src/user-reference.model.ts`:

```ts
@ObjectType('User')
@Directive('@key(fields: "id")')
export class UserReference {
  @Field(() => ID)
  id!: string;

  @Field(() => [Animation])
  animations!: Animation[];
}
```

This is a **stub**, not a duplicate of the real `User`. It only declares
`id` (the key) and the one field this subgraph actually owns and can
resolve: `animations`. It deliberately does *not* declare `name` or
`email` — this subgraph has no data for those, and if a client asks for
them, the gateway routes that part of the query to the `users` subgraph
instead. Ownership follows data: whichever subgraph holds the data a field
needs is where that field is defined.

Because `UserReference` is never returned by a query in this subgraph
(it's only ever reached via `_entities`), NestJS's code-first schema
builder won't include it automatically — that's what
`buildSchemaOptions.orphanedTypes: [UserReference]` in
`animations/src/app.module.ts` is for. Forget it, and you'll hit
`"User" defined in resolvers, but not in schema` at startup.

## 4. Seeing the machinery: `_entities` and `representations`

`gateway/src/main.ts` has a `LoggingDataSource` (subclass of
`RemoteGraphQLDataSource`) that logs every outgoing subgraph request. Run
the query above and you'll see two requests in the gateway terminal:

```
--> [gateway -> http://localhost:3001/graphql]
query: {users{__typename id name}}

--> [gateway -> http://localhost:3002/graphql]
query: query($representations:[_Any!]!){_entities(representations:$representations){...on User{animations{id title durationMs}}}}
variables: {
  "representations": [
    { "__typename": "User", "id": "1" },
    { "__typename": "User", "id": "2" },
    { "__typename": "User", "id": "3" }
  ]
}
```

The first call gets the base `User` list from `users`. The second is the
**entity resolution** call: the gateway hands `animations` a
`representations` array — one entry per user, each just `{ __typename,
id }` — and asks it to resolve the `animations` field for each. This is
the `_entities(representations: [_Any!]!): [_Entity]!` field that
`@apollo/subgraph` adds to every federated schema automatically (see the
`_service.sdl` output in section 2). `users.resolver.ts` and
`user-reference.resolver.ts` each implement `@ResolveReference()` — that
method is what answers this query on each subgraph.

Critically: **one HTTP request**, carrying all three representations —
not three separate requests. That's Federation's batching, and it's the
reason the N+1 in the next section happens *inside* the subgraph process,
not on the wire.

## 5. The query plan

Same run, gateway terminal, printed via `experimental_didResolveQueryPlan`
in `gateway/src/main.ts`:

```
QueryPlan {
  Sequence {
    Fetch(service: "users") {
      { users { __typename id name } }
    },
    Flatten(path: "users.@") {
      Fetch(service: "animations") {
        { ... on User { __typename id } } =>
        { ... on User { animations { id title durationMs } } }
      },
    },
  },
}
```

Read this as: fetch `users` first (`Sequence`), then for every user in the
result (`Flatten(path: "users.@")` — the `@` means "for each item in this
list"), fetch `animations` from the `animations` subgraph. This plan is
computed once per unique query shape, not per request — the gateway caches
it.

## 6. N+1 — inside a subgraph vs. across the gateway

`animations/src/animations.data.ts` has a deliberately naive lookup that
logs and counts every call. `user-reference.resolver.ts` picks between it
and a `DataLoader` based on the `USE_DATALOADER` env var.

Run with `USE_DATALOADER` unset (or `false`) and query 3 users with their
animations — the animations terminal logs:

```
naive lookup #1 for ownerId=1
naive lookup #2 for ownerId=2
naive lookup #3 for ownerId=3
```

Three calls — even though the gateway only sent **one** `_entities`
request (see section 4). That's the distinction: `@ResolveField()` on
`animations` runs once per object in the batched result, inside the same
subgraph process, in the same request. The gateway did its job (one round
trip); the subgraph's own field resolver is what fans out.

Run with `USE_DATALOADER=true npm start` (in `animations/`) and rerun the
same query:

```
batched lookup for ownerIds=[1, 2, 3]
```

One call. `animations/src/animations.loader.ts` creates a fresh
`DataLoader` per request (via the `context` factory in
`animations/src/app.module.ts`); every `.load(ownerId)` call made during
the same tick gets collected and dispatched together.

**The interview-ready distinction:** N+1 *across the gateway* would mean
the gateway makes a separate network call to a subgraph per entity —
Federation's `_entities` batching prevents that by design. N+1 *inside a
subgraph* means the field resolver that answers those batched entities
does its own per-item work (a DB query, a service call) without batching
— that's an ordinary N+1 problem, own by that subgraph, fixed the ordinary
way: DataLoader.

## 7. `@override` and `@shareable` — ownership experiments

These aren't wired into the running code (moving fields around would leave
the reference project broken), but here's exactly what to do to see them,
plus the exact error you'd hit.

**`@override` — moving a field's ownership:** say the `animations`
subgraph wants to take over resolving `Animation.durationMs` from a new
source, but it needs to declare it's taking that field from wherever it
was before. Federation's syntax:

```ts
@Field(() => Int)
@Directive('@override(from: "animations")')
durationMs!: number;
```

`@override(from: "X")` tells composition "this field used to belong to
subgraph X; it's mine now" — composition silently drops the field
definition from X's copy in the supergraph. It's meant for zero-downtime
migrations: you deploy the new owner with `@override` first, verify it
work, then remove the field from the old subgraph.

**`@shareable` and the composition error:** try adding `name` to the
`UserReference` stub in `animations/src/user-reference.model.ts`, without
`@shareable` anywhere:

```ts
@ObjectType('User')
@Directive('@key(fields: "id")')
export class UserReference {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string; // <-- also defined, unshared, in `users`

  @Field(() => [Animation])
  animations!: Animation[];
}
```

Restart, and the gateway's composition step (inside `IntrospectAndCompose`
in `gateway/src/main.ts`) fails with something like:

```
Non-shareable field "User.name" is resolved from multiple subgraphs:
it is resolved from subgraphs "users" and "animations" and defined as
non-shareable in subgraph "users"
```

Federation 2's default is: a field can only be owned by one subgraph
unless every subgraph defining it marks it `@shareable`. This is the
safety rail against two subgraphs silently disagreeing about what a field
means. Fix it either by removing the duplicate, or by adding
`@Directive('@shareable')` to `name` in **both** places if you actually
want two subgraphs computing it independently (e.g. a cached/denormalized
copy).

## 8. A third subgraph: `projects`, and a 1:* relationship both ways

`projects` (port 3003) owns `Project { id, name }`. The relationship is
**one animation, many projects** — so, same rule as `User`/`Animation`
(FK lives on the "many" side), the foreign key sits on `Project`, not on
`Animation`:
```ts
// projects/src/project.model.ts
@Field(() => ID)
animationId!: string;
```
`Animation` itself carries nothing new — it stays completely agnostic of
`Project`, exactly the way `users` is agnostic of `Animation` beyond its
own plain `resolveReference`.

The relationship is federated **in both directions**, and — this is the
easy part to get backwards — *which subgraph resolves which direction
follows data ownership, not which table holds the foreign key*:

- **Reverse (`Animation.projects`, a list)** — parent is `Animation`, but
  resolving it needs `Project` data (filtered by `animationId`), and only
  `projects` has that. So this lives entirely in the `projects` subgraph:
  `animation-reference.model.ts` declares a stub `Animation` type (`id` +
  `projects`), and `animation-reference.resolver.ts` resolves it — a
  line-for-line mirror of the `User`/`UserReference` pair, just relocated.
  `animations` subgraph has zero code for this direction.
- **Forward (`Project.animation`, a single object)** — parent is
  `Project`, which *does* have the FK (`animationId`), so `projects` can
  produce a stub reference itself. Added as a `@ResolveField()`-only
  method in `projects/src/projects.resolver.ts`, not as a `@Field()` on
  the `Project` class — same circular-import dodge as before (`Project`
  would otherwise need `AnimationReference`, which already imports
  `Project` for its own `projects` field):
  ```ts
  @ResolveField(() => AnimationReference)
  animation(@Parent() project: Project): Partial<AnimationReference> {
    return { id: project.animationId };
  }
  ```
  The gateway fills in anything beyond `id` (e.g. `title`) by calling
  `animations`' existing, unmodified `resolveReference` — the same method
  that already answered plain `{ animation(id) { title } }` queries. It
  never needed to know `Project` exists.

Querying `{ animations { projects { name } } }` produces a plan with
**two** `Flatten` steps — fetch `animations`, then fetch `projects` for
each animation's `projects` list. Fake data has `a1` owning two projects
(`p1`, `p2`) on purpose, so you can see the 1:* multiplicity directly in
the response — query `{ projects { name animation { title } } }` and both
`p1` and `p2` correctly point back to the same `a1`.

**The one-sentence version for the interview:** the foreign key only
tells you which subgraph can produce the *stub reference* for the other
side; which subgraph fills in the *rest of the fields* is decided purely
by who owns that data, regardless of where the FK column lives.

## 9. Service layer

Every subgraph follows the standard NestJS `resolver → service` split —
resolvers only know about GraphQL types/args and delegate everything else,
services own the actual data and lookups. The one interesting piece is
`animations/src/animations.loader.ts`: `AnimationsLoader` is
`@Injectable({ scope: Scope.REQUEST })`, so Nest constructs a fresh
instance (and therefore a fresh, empty `DataLoader`) per GraphQL request
automatically — no manual wiring through the GraphQL `context` option
needed. Injecting a request-scoped provider into `UserReferenceResolver`
bumps that resolver to request scope too, which is expected and standard.

---

## Files map

| Concept | File |
|---|---|
| `User` entity, `@key` | `users/src/user.model.ts` |
| `users` data + lookups | `users/src/users.service.ts` |
| `users` resolver + `resolveReference` | `users/src/users.resolver.ts` |
| `users` federation driver config | `users/src/app.module.ts` |
| `Animation` entity | `animations/src/animation.model.ts` |
| `animations` data + naive/batched lookups | `animations/src/animations.service.ts` |
| Request-scoped DataLoader | `animations/src/animations.loader.ts` |
| `User` stub / entity extension | `animations/src/user-reference.model.ts` |
| Cross-subgraph field resolver (User side) | `animations/src/user-reference.resolver.ts` |
| `animations` federation driver + `orphanedTypes` | `animations/src/app.module.ts` |
| `Project` entity, `@key`, FK (`animationId`) | `projects/src/project.model.ts` |
| `projects` data + lookups | `projects/src/projects.service.ts` |
| `projects` resolver + `resolveReference` + forward reference (`Project.animation`) | `projects/src/projects.resolver.ts` |
| `Animation` stub / reverse reference | `projects/src/animation-reference.model.ts`, `animation-reference.resolver.ts` |
| Gateway, request logging, query plan | `gateway/src/main.ts` |
