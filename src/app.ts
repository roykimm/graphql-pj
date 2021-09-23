import express, { response } from 'express';
import {graphqlHTTP} from 'express-graphql';
import dotenv from 'dotenv';
import { schema, root} from './api/schema';
import { createConnection } from 'typeorm';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Access from './entity/access';

dotenv.config();
createConnection().then(async connection => {
    await Access.load();
    const app = express();
    app.use(cors())
    app.use(express.json());
    app.use(cookieParser());

    app.use(process.env.GRAPHQL_PATH!, graphqlHTTP((request, response, graphQLParams) => ({
        schema: schema,
        rootValue : root,
        graphiql: true,
        context : {
            req : request,
            res : response,
        }
    })));

    app.listen(parseInt(process.env.APP_PORT!));
    const link = `http://localhost:${process.env.APP_PORT!}${process.env.GRAPHQL_PATH}`;
    console.log(`Server started at url: ${link}`);

}).catch(err => {
    console.log(err)
})
