import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ProjectsResolver } from './projects.resolver';
import { AnimationReferenceResolver } from './animation-reference.resolver';
import { AnimationReference } from './animation-reference.model';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'src/schema.gql'),
        federation: 2,
      },
      // AnimationReference is only reachable as a `_entities` reference —
      // the code-first schema builder needs an explicit nudge to include it.
      buildSchemaOptions: {
        orphanedTypes: [AnimationReference],
      },
      sortSchema: true,
      playground: true,
    }),
  ],
  providers: [ProjectsResolver, AnimationReferenceResolver, ProjectsService],
})
export class AppModule {}
