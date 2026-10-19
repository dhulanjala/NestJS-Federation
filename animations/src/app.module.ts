import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AnimationsResolver } from './animations.resolver';
import { UserReferenceResolver } from './user-reference.resolver';
import { UserReference } from './user-reference.model';
import { AnimationsService } from './animations.service';
import { AnimationsLoader } from './animations.loader';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'src/schema.gql'),
        federation: 2,
      },
      // UserReference is never returned by a query in THIS subgraph — it's
      // only reachable as a `_entities` reference — so the code-first schema
      // builder needs an explicit nudge to still include it.
      buildSchemaOptions: {
        orphanedTypes: [UserReference],
      },
      sortSchema: true,
      playground: true,
    }),
  ],
  providers: [AnimationsResolver, UserReferenceResolver, AnimationsService, AnimationsLoader],
})
export class AppModule {}
