import { Directive, Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType() // this class treat  as a graphql type
@Directive('@key(fields: "id")')
export class Animation {
  @Field(() => ID)
  id!: string;// TypeScript, trust me. I promise I will assign a value to id before it is used.

  @Field()
  title!: string;

  @Field(() => Int)
  durationMs!: number;

  @Field(() => ID)
  ownerId!: string; // identifier for owner
}
