import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { prettyFormatQueryPlan } from '@apollo/query-planner';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

// This subclass is the hook point for seeing exactly what the gateway sends
// to each subgraph over HTTP — including the `_entities` query and the
// `representations` array for entity resolution (step 4 of the original
// learning plan: "see the machinery").
class LoggingDataSource extends RemoteGraphQLDataSource {
  override willSendRequest({ request, context }: any) {
    console.log(`\n--> [gateway -> ${this.url}]`);
    console.log('query:', request.query);
    if (request.variables && Object.keys(request.variables).length > 0) {
      console.log('variables:', JSON.stringify(request.variables, null, 2));
    }
  }
}

function makeGateway() {
  return new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'users', url: 'http://localhost:3001/graphql' },
        { name: 'animations', url: 'http://localhost:3002/graphql' },
        { name: 'projects', url: 'http://localhost:3003/graphql' },
      ],
    }),
    buildService({ url }) {
      return new LoggingDataSource({ url });
    },
    experimental_didResolveQueryPlan({ queryPlan }) {
      console.log('\n=== query plan ===');
      console.log(prettyFormatQueryPlan(queryPlan));
      console.log('===================\n');
    },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function bootstrap() {
  // The subgraphs might still be booting when this process starts (we run
  // all three with one `npm run dev`), so retry composing the supergraph a
  // few times before giving up.
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const server = new ApolloServer({ gateway: makeGateway() });
      const { url } = await startStandaloneServer(server, {
        listen: { port: 4000 },
      });
      console.log(`gateway ready at ${url}`);
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`[gateway] subgraphs not ready yet, retrying (${attempt}/${maxAttempts})...`);
      await sleep(2000);
    }
  }
}

bootstrap();
