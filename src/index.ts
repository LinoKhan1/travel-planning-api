import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OpenMeteoDataSource } from './datasources/OpenMeteoDataSource';
import { resolvers } from './resolvers/resolvers';

// Load schema from schema.graphql
const typeDefs = readFileSync(join(__dirname, 'schema/schema.graphql'), 'utf-8');

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Initialize Apollo Server with data sources
const server = new ApolloServer({
  schema,
  dataSources: () => ({
    openMeteo: new OpenMeteoDataSource(),
  }),
});

// Start server
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});