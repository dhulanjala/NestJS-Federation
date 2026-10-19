import { Args, ID, Query, ResolveReference, Resolver } from '@nestjs/graphql';
import { Animation } from './animation.model';
import { AnimationsService } from './animations.service';

@Resolver(() => Animation)
export class AnimationsResolver {
  constructor(private readonly animationsService: AnimationsService) {}

  @Query(() => [Animation])
  animations(): Animation[] {
    return this.animationsService.findAll();
  }

  @Query(() => Animation, { nullable: true })
  animation(@Args('id', { type: () => ID }) id: string): Animation | undefined {
    return this.animationsService.findById(id);
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): Animation | undefined {
    return this.animationsService.findById(reference.id);
  }
}
