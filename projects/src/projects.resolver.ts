import { Args, ID, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { Project } from './project.model';
import { ProjectsService } from './projects.service';
import { AnimationReference } from './animation-reference.model';

@Resolver(() => Project)
export class ProjectsResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @Query(() => [Project])
  projects(): Project[] {
    return this.projectsService.findAll();
  }

  @Query(() => Project, { nullable: true })
  project(@Args('id', { type: () => ID }) id: string): Project | undefined {
    return this.projectsService.findById(id);
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): Project | undefined {
    return this.projectsService.findById(reference.id);
  }

  // Forward direction — resolver-only field (not declared on the Project
  // class), same circular-import-avoidance trick used for Animation.project
  // before: Project would otherwise need AnimationReference, which already
  // imports Project for its own `projects` field. Just a stub `{ id }` —
  // the gateway routes to `animations` via `_entities` for anything else.
  @ResolveField(() => AnimationReference)
  animation(@Parent() project: Project): Partial<AnimationReference> {
    return { id: project.animationId };
  }
}
