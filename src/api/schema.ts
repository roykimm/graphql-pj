import { buildSchema } from 'graphql';
import User from '../entity/user';
import Memo from '../entity/memo';
import Gallery from '../entity/gallery';
import { parseAccessToken, setRefreshTokenCookie, handlePasswordChange, handleSendEmailRequest } from './helpers';
import Mailer from '../utils/mailer';
import Access from '../entity/access';
import { Stream } from 'stream';
import { GraphQLUpload } from 'graphql-upload';

const path = require('path');
const fs = require('fs');
const mime = require('mime');

export const schema = buildSchema(`
  scalar Upload

  type Profile {
    ukey: ID
    email: String
    username : String
  }

  type MemoProfile {
    id : Int
    email : String
    username : String
    title : String
    content : String
  }

  type GalleryProfile {
    id : Int
    username : String
    filename : String
    sort : String
  }

  type File {
    url: String!
  }

  type Query {
    profile: Profile
    memoProfile : MemoProfile
    galleryProfile : GalleryProfile
    test(email: String!): Profile
  }
  type Mutation {
    register(email: String!, password: String!, confirmation: String!, username:String!): Boolean
    login(email: String!, password: String!): AccessToken
    confirm(email: String!): Boolean
    resendConfirmation(email: String!): Boolean
    refresh: AccessToken
    forgotPassword(email: String!): Boolean
    resetPassword(password: String!, confirmation: String!): Boolean
    logout: Boolean

    memoRegister(email:String!, username:String!, title: String!, content: String!) :Boolean
    memoUpdate(id:ID!, title: String!, content: String!): Boolean

    galleryRegister(username:String!, filename:String!, sort:String!) : Boolean 
    uploadFile(file: Upload!): File!
  }

  type AccessToken {
    ukey: ID
    access_token: ID
  }
  
`);

function generateRamdomString(length : number) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

interface Upload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => Stream;
}

export const root = {
  test : async({email} : {email:string}, context: any) => {
    const user = await User.getByEmail(email);
    return user;
  },
  Upload: GraphQLUpload,

  uploadFile: async ({ file } : { file : any}, context: any) => {
    console.log('uploadFile')
    console.log(file)
    const { createReadStream, filename, mimetype, encoding } = await file;

    console.log("filename : " + filename)
    const { ext, name } = path.parse(filename);
    const randomName = generateRamdomString(12) + ext;

    const stream = createReadStream();
    const pathName = path.join(__dirname, `/public/images/${randomName}`)
    await stream.pipe(fs.createWriteStream(pathName));

    return {
        url : `http://localhost:5000/images/${randomName}`
    }
  },

  galleryRegister : async ({username, filename, sort}: {username:string, filename: string, sort: string}, context: any) => {
    const result = await Gallery.galleryRegister(username, filename, sort);
    if(result.isError()){
      throw result.getError()!
    }
    return true;
  },

  memoRegister : async ({ email, username, title, content }: { email: string, username: string, title: string , content: string}, context: any) => {
    const result = await Memo.memoRegister(email, username, title, content);
    if (result.isError())
      throw result.getError()!
    return true;
  },

  register: async ({ email, password, confirmation, username }: { email: string, password: string, confirmation: string , username: string}, context: any) => {
    const result = await User.register(email, password, confirmation, username);
    context.res.status(result.status);
    if (result.isError())
      throw result.getError()!
    const user = result.getObject()!;
    const confirmToken = Access.encode(user.ukey, user.refreshIndex, process.env.ACCESS_TYPE_CONFIRM!);
    if (confirmToken == undefined) {
      context.res.status(500);
      throw new Error('Confirmation failed');
    }
    await Mailer.sendConfirmation(user.email, confirmToken);
    return true;
  },

  resendConfirmation: async ({ email }: { email: string }, context: any) => {
    return await handleSendEmailRequest(email, context.res, true, process.env.ACCESS_TYPE_CONFIRM!);
  },

  confirm: async ({ email }: { email: string }, context: any) => {
    const accessId = Access.idFromName(process.env.ACCESS_TYPE_CONFIRM!);
    let result = parseAccessToken(context.req, accessId);
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    const claims = result.getObject()!;
    if (claims.act != accessId) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
    }

    if (email != user.email) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    result = await user.updateConfirmed();
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    context.res.status(200);
    return true;
  },

  login: async ({ email, password }: { email: string, password: string }, context: any) => {
    const result = await User.login(email, password);
    context.res.status(result.status);
    if (result.isError())
      throw result.getError()!;

    const user = result.getObject()!;
    const accessToken = Access.encode(user.ukey, user.refreshIndex, process.env.ACCESS_TYPE_USER!);
    const refreshToken = Access.encode(user.ukey, user.refreshIndex, process.env.ACCESS_TYPE_REFRESH!);

    if (accessToken == undefined || refreshToken == undefined) {
      context.res.status(500);
      throw new Error('Login failed');
    }

    setRefreshTokenCookie(context.res, refreshToken);
    context.res.status(200);

    return { ukey: user.ukey, refresh_token: refreshToken, access_token: accessToken };
  },

  profile: async ({ }: {}, context: any) => {
    const accessId = Access.idFromName(process.env.ACCESS_TYPE_USER!);
    const result = parseAccessToken(context.req, accessId);
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    const claims = result.getObject()!;
    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
    }

    return user;
  },

  refresh: async ({ }: {}, context: any) => {
    const token = context.req.cookies[process.env.REFRESH_TOKEN_NAME!];
    context.res.status(401);
    if (token == undefined)
      throw new Error('Not authorized');

    const claims = Access.decode(token, Access.idFromName(process.env.ACCESS_TYPE_REFRESH!));
    if (claims == undefined)
      throw new Error('Not authorized');

    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined)
      throw new Error('Not authorized');

    const result = await user.updateRefreshIndex();
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }
    user.refreshIndex += 1;

    const refreshToken = Access.encode(user.ukey, user.refreshIndex, process.env.ACCESS_TYPE_REFRESH!);
    const accessToken = Access.encode(user.ukey, user.refreshIndex, process.env.ACCESS_TYPE_REFRESH!);
    if (refreshToken == undefined || accessToken == undefined) {
      context.res.status(500);
      throw new Error('Refresh failed');
    }

    setRefreshTokenCookie(context.res, refreshToken);
    context.res.status(200);
    return { ukey: user.ukey, access_token: accessToken };
  },

  forgotPassword: async ({ email }: { email: string }, context: any) => {
    return await handleSendEmailRequest(email, context.res, false, process.env.ACCESS_TYPE_PASSWORD_RESET!);
  },

  resetPassword: async ({ password, confirmation }: { password: string, confirmation: string }, context: any) => {
    const accessId = Access.idFromName(process.env.ACCESS_TYPE_PASSWORD_RESET!);
    return await handlePasswordChange(undefined, password, confirmation, context.req, context.res, accessId);
  },

  logout: async ({ }: {}, context: any) => {
    const result = parseAccessToken(context.req, Access.idFromName(process.env.ACCESS_TYPE_USER!));
    context.res.status(401);
    if (result.isError())
      throw new Error('Not authorized');

    const token = context.req.cookies[process.env.REFRESH_TOKEN_NAME!];
    if (token == undefined)
      throw new Error('Not authorized');

    const claims = Access.decode(token, Access.idFromName(process.env.ACCESS_TYPE_REFRESH!));
    if (claims == undefined)
      throw new Error('Not authorized');

    context.res.status(200);
    context.res.clearCookie(process.env.REFRESH_TOKEN_NAME!);
    return true;
  },

};