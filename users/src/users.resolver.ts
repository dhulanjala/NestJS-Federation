import { Args, ID, Query, ResolveReference, Resolver } from '@nestjs/graphql';
import { User } from './user.model';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  users(): User[] {
    return this.usersService.findAll();
  }

  @Query(() => User, { nullable: true })
  user(@Args('id', { type: () => ID }) id: string): User | undefined {
    return this.usersService.findById(id);
  }

  // Answers the gateway's `_entities` query. The `reference` object is one
  // entry of the `representations` array the gateway sends over the wire —
  // here it's just `{ __typename: 'User', id: '...' }` because that's all
  // the @key(fields: "id") directive promises other subgraphs.
  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): User | undefined {
    return this.usersService.findById(reference.id);
  }
}
