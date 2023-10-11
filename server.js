const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const http = require("http");
const { PubSub } = require("graphql-subscriptions");
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { execute, subscribe } = require('graphql');

const { makeExecutableSchema } = require('graphql-tools');


const port = process.env.PORT || 4001;
const pubsub = new PubSub();

const app = express();

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

const typeDefs = `
    type Query {
        squares: [Position!]!
        container: Container!
    }

    type Position {
        id: ID!
        x: Float!
        y: Float!
        color: String!
    }

    type Container {
        width: Float!
        height: Float!
        numOfSquares: Int!
    }
    
    input ContainerInput {
        width: Float!
        height: Float!
        numOfSquares: Int!
    }

    type Subscription {
        updatedSquares: [Position!]!
    }

    type Mutation {
        sendSquareUpdates(squares: [PositionInput!]!): [Position!]!
        initializeContainer(dimensions: ContainerInput!): Container!
    }

    input PositionInput {
        id: ID!
        x: Float
        y: Float
    }
`;

let container = { width: 800, height: 600, numOfSquares: 10 };
let squares = [];

const getRandomColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
};

const initializeContainer = (dimensions) => {
    container = dimensions;
    squares = Array.from({ length: container.numOfSquares }, (_, idx) => ({
        id: `${idx}`,
        x: Math.random() * container.width,
        y: Math.random() * container.height,
        color: getRandomColor()
    }));
}
initializeContainer(container);

const updateRandomSquarePositions = (numberOfUpdates) => {
    if (!squares.length) return [];

    const updatedSquares = [];

    for (let i = 0; i < numberOfUpdates; i++) {
        const randomSquare = squares[Math.floor(Math.random() * squares.length)];

        randomSquare.x = Math.random() * container.width;
        randomSquare.y = Math.random() * container.height;

        if (!updatedSquares.some(sq => sq.id === randomSquare.id)) {
            updatedSquares.push(randomSquare);
        }
    }

    return updatedSquares;
};

setInterval(() => {
    // Decide the number of updates, for example, between 1 and 3
    const numUpdates = Math.floor(Math.random() * 3) + 1;

    const updatedSquares = updateRandomSquarePositions(numUpdates);
    if (updatedSquares.length) {
        pubsub.publish('UPDATED_SQUARES', { updatedSquares });
    }
}, 1000);

const resolvers = {
    Query: {
        squares: () => squares,
        container: () => container,
    },
    Mutation: {
        sendSquareUpdates: (parent, args) => {
            args.squares.forEach(square => {
                const index = squares.findIndex(c => c.id === square.id);
                if (index >= 0) {
                    squares[index] = square;
                } else {
                    squares.push(square);
                }
            });
            pubsub.publish('UPDATED_SQUARES', { updatedSquares: squares });
            return squares;
        },
        initializeContainer: (parent, args) => {
            initializeContainer(args.dimensions);
            return args.dimensions;
        },
    },
    Subscription: {
        updatedSquares: {
            subscribe: () => pubsub.asyncIterator(['UPDATED_SQUARES'])
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

new SubscriptionServer({
    execute,
    subscribe,
    schema,
}, {
    server: httpServer,
    path: '/graphql',
});

httpServer.listen(port, () => {
    console.log(`graphql server is running: http://localhost:${port}${apolloServer.graphqlPath}`);
});
