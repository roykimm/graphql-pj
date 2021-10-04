import dotenv from 'dotenv';
dotenv.config();

import express, { response } from 'express';
import {graphqlHTTP} from 'express-graphql';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Access from './entity/access';
import logger from 'morgan';

import { schema, root} from './api/schema';
import { createConnection } from 'typeorm';

import { GraphQLUpload,graphqlUploadExpress } from 'graphql-upload'


createConnection().then(async connection => {
    await Access.load();
    const app = express();
    const corsOptions = {
        origin : process.env.CORS_ORIGIN!,
        credentials : true,
        optionsSuccessStatus : 200
    }

    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(cookieParser());
    app.use(logger('dev'));

    app.use(express.static('public'));

    app.use(
        process.env.GRAPHQL_PATH!, 
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        graphqlHTTP((request, response, graphQLParams) => ({
        schema: schema,
        rootValue : root,
        graphiql: true,
        context : {
            req : request,
            res : response,
        }})),
    );

    app.listen(parseInt(process.env.APP_PORT!));
    const link = `http://localhost:${process.env.APP_PORT!}${process.env.GRAPHQL_PATH}`;
    console.log(`Server started at url: ${link}`);

}).catch(err => {
    console.log(err)
})
