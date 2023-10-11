const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const http = require("http");
const { PubSub } = require("graphql-subscriptions");
const { useServer } = require('graphql-ws/lib/use/ws');
const { execute, subscribe } = require('graphql');
const { makeExecutableSchema } = require('graphql-tools');
const WebSocket = require('ws');


const port = process.env.PORT || 4001;
const pubsub = new PubSub();

const app = express();

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

const typeDefs = `
    type Query{
        totalPosts: Int!
    }
    type Position {
        x: Float!
        y: Float!
    }
    
    type Subscription {
        newPosition: Position!
    }
    
    type Mutation {
        sendPosition(x: Float, y: Float): Position!
    }
`;

const resolvers = {
    Query: {
        totalPosts: () => 100,
    },
    Subscription: {
        newPosition: {
            subscribe: () => pubsub.asyncIterator(['NEW_POSITION'])
        }
    },
    Mutation: {
        sendPosition: (parent, args) => {
            const position = {
                x: args.x || Math.random() * 100,
                y: args.y || Math.random() * 100
            };
            pubsub.publish('NEW_POSITION', { newPosition: position });
            return position;
        }
    }
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
    apolloServer = new ApolloServer({
        schema,
        introspection: true,
        playground: true,
    });
    await apolloServer.start();
    apolloServer.applyMiddleware({ app });
}
startServer();

const httpServer = http.createServer(app);

// Create a WebSocket server
const wsServer = new WebSocket.Server({
    server: httpServer,
    path: '/graphql',
});

// Use graphql-ws with the WebSocket server
useServer(
    {
        schema,
        execute,
        subscribe
    },
    wsServer
);

httpServer.listen(port, () => {
    console.log(`graphql server is running: http://localhost:${port}${apolloServer.graphqlPath}`);
});