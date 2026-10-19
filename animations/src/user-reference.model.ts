import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { Animation } from './animation.model';

// This subgraph does not own User — it only knows the `id` (the @key) and
// extends the entity with a field this subgraph *does* own: `animations`.
// No `name`/`email` here on purpose; asking for those on a query would be
// routed by the gateway back to the `users` subgraph.
@ObjectType('User')
@Directive('@key(fields: "id")')
export class UserReference {
  @Field(() => ID)
  id!: string;

  @Field(() => [Animation])
  animations!: Animation[];
}
