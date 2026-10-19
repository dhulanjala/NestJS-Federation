import { Directive, Field, ID, ObjectType } from "@nestjs/graphql";


@ObjectType()
@Directive('@key(fields: "id")') // id is reference key "you can reference a User by its id even though you don't have the rest of its data."
export class User {
  @Field(() => ID) // explicitly tell to graphql get this field type as ID
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;
}
