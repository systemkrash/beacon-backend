import express from "express";
import expressJWT from "express-jwt";
import { ApolloServer, PubSub } from "apollo-server-express";
import mongoose from "mongoose";

import typeDefs from "./schema.js";
import resolvers from "./resolvers.js";
import User from "./models/user.js";

const pubsub = new PubSub();

let currentNumber = 0;
function incrementNumber() {
    currentNumber++;
    pubsub.publish("NUMBER_INCREMENTED", { numberIncremented: currentNumber });
    setTimeout(incrementNumber, 1000);
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
        const user = req.user ? await User.findById(req.user.sub) : null;
        return { user, pubsub, currentNumber };
    },
    subscriptions: {
        path: "/subscriptions",
        onConnect: () => {
            console.log("Client connected");
        },
        onDisconnect: () => {
            console.log("Client disconnected");
        },
    },
});

const app = express();

app.get("/", (req, res) => res.send("Hello World! This is a GraphQL API. Check out /graphql"));

app.use(
    expressJWT({
        secret: process.env.JWT_SECRET,
        algorithms: ["HS256"],
        credentialsRequired: false,
    })
);

server.applyMiddleware({ app });

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose
    .connect(uri, options)
    .then(() =>
        app.listen(
            { port: 4000 },
            console.log(
                `Server ready at http://localhost:4000${server.graphqlPath}\n` +
                    `Subscriptions endpoint at ws://localhost:4000${server.subscriptionsPath}`
            )
        )
    )
    .catch(error => {
        throw error;
    });

incrementNumber();
