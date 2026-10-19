import { Parent, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { UserReference } from './user-reference.model';
import { Animation } from './animation.model';
import { AnimationsService } from './animations.service';
import { AnimationsLoader } from './animations.loader';

const USE_DATALOADER = process.env.USE_DATALOADER === 'true';

@Resolver(() => UserReference)
export class UserReferenceResolver {
  constructor(
    private readonly animationsService: AnimationsService,
    private readonly animationsLoader: AnimationsLoader,
  ) {}

  // The gateway sends `_entities` with representations like
  // `{ __typename: 'User', id: '1' }` — one per user needed in the response,
  // batched into a SINGLE request. We don't have the user's data (no
  // name/email here), so we just echo back the id; NestJS then calls
  // `animations()` below once per returned object to fill in the rest.
  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): Partial<UserReference> {
    return { id: reference.id };
  }

  @ResolveField(() => [Animation])
  async animations(@Parent() user: UserReference): Promise<Animation[]> {
    if (USE_DATALOADER) {
      return this.animationsLoader.load(user.id);
    }
    return this.animationsService.findByOwnerIdNaive(user.id);
  }
}
