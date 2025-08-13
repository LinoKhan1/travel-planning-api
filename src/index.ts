import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load schema from schema.graphql
const typeDefs = readFileSync(join(__dirname, 'schema/schema.graphql'), 'utf-8');

// Placeholder resolvers (to be implemented in Phase 3)
const resolvers = {};

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Initialize Apollo Server
const server = new ApolloServer({ schema });

// Start server
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});