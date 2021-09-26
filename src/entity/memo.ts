import Database from '../utils/database';
import Result from '../utils/result';
import { v4 as uuidv4 } from 'uuid';
import { Entity, PrimaryGeneratedColumn, Index, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('memo')
export default class Memo {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({nullable: false, length:50, unique: true})
    email : string;

    @Column({ nullable : true, length: 200})
    username : string;

    @Column({ nullable : true, length: 500})
    title : string;

    @Column({ nullable : true, length: 4000})
    content : string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    constructor(email: string, username: string, title: string, content: string) {
        this.id = 0;
        this.email = email;
        this.username = username;
        this.title = title;
        this.content = content;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    static async memoRegister(email: string, username : string, title: string, content: string): Promise<Result<Memo>>{
        if(!email){
            return new Result<Memo>(new Error('이메일이 유효하지 않습니다.'), 400);
        }

        try {
            const memo = new Memo(email, username, title, content);
            if(await memo.save()){
                return new Result<Memo>(memo, 201);
            }
            return new Result<Memo>(new Error('등록에 실패하였습니다.'),400);
        } catch(err) {
            console.log(err);
            return new Result<Memo>(new Error('등록에 실패하였습니다.'),400);
        }
    }

    async save(): Promise<boolean> {
        const db = new Database<Memo>(Memo);
        return await db.save(this);
    }

    static async getMemoByEmail(email: string): Promise<Memo | undefined> {
        const db = new Database<Memo>(Memo);
        return await db.get({ email });
      }

    static async memoUpdate(id: number, title: string | undefined, content: string | undefined) : Promise<Result<boolean>> {
        const values = { title: title, content : content };
        const filter = `id = ${id}`;
        const db = new Database<Memo>(Memo);
        const success = await db.update('memo', values, filter);
        return success ? new Result<boolean>(true, 200) : new Result<boolean>(new Error('Update failed'), 500);
    }
}