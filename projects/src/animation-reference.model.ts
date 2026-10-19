import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { Project } from './project.model';

// This subgraph doesn't own Animation — it only knows the `id` (the @key)
// and contributes the one field it can resolve: the reverse side of the
// 1:* relationship (one animation, many projects).
@ObjectType('Animation')
@Directive('@key(fields: "id")')
export class AnimationReference {
  @Field(() => ID)
  id!: string;

  @Field(() => [Project])
  projects!: Project[];
}
