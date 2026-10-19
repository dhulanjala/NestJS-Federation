import { Parent, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { AnimationReference } from './animation-reference.model';
import { Project } from './project.model';
import { ProjectsService } from './projects.service';

@Resolver(() => AnimationReference)
export class AnimationReferenceResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): Partial<AnimationReference> {
    return { id: reference.id };
  }

  @ResolveField(() => [Project])
  projects(@Parent() animation: AnimationReference): Project[] {
    return this.projectsService.findByAnimationId(animation.id);
  }
}
