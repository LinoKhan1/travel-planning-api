// Importing required dependencies for the Apollo Server and schema setup
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OpenMeteoDataSource } from './datasources/OpenMeteoDataSource';
import { resolvers } from './resolvers/resolvers';

// Loading the GraphQL schema from the schema.graphql file
// Uses fs.readFileSync to read the file synchronously and path.join to construct the file path
const typeDefs = readFileSync(join(__dirname, 'schema/schema.graphql'), 'utf-8');

// Creating an executable GraphQL schema
// Combines type definitions (typeDefs) and resolvers to define the API's structure and behavior
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Initializing the Apollo Server
// Configures the server with the executable schema and data sources for API requests
const server = new ApolloServer({
  schema,
  dataSources: () => ({
    // Instantiating OpenMeteoDataSource for geocoding and weather forecast API calls
    openMeteo: new OpenMeteoDataSource(),
  }),
});

// Starting the Apollo Server
// Listens on the default port (4000) and logs the server URL when ready
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});