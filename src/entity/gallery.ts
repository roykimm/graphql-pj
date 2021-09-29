import Database from '../utils/database';
import Result from '../utils/result';
import { v4 as uuidv4 } from 'uuid';
import { Entity, PrimaryGeneratedColumn, Index, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('gallery')
export default class Gallery{
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable : false, length: 200})
    username : string;

    @Column({ nullable : false, length : 100})
    filename : string;

    @Column({ nullable : false, length: 100})
    sort : string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    constructor(username: string, filename: string, sort: string) {
        this.id = 0;
        this.username = username;
        this.filename = filename;
        this.sort = sort;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    static async galleryRegister(username: string, filename: string, sort: string): Promise<Result<Gallery>>{
        if(!username){
            return new Result<Gallery>(new Error('유저명이 유효하지 않습니다.'), 400);
        }

        if(!filename){
            return new Result<Gallery>(new Error('파일명이 유효하지 않습니다.'), 400);
        }

        if(!sort){
            return new Result<Gallery>(new Error('분류가 유효하지 않습니다.'), 400);
        }

        try {
            const gallery = new Gallery(username, filename, sort);
            if(await gallery.save()){
                return new Result<Gallery>(gallery, 201);
            }
            return new Result<Gallery>(new Error('등록에 실패하였습니다.'),400);
        } catch(err) {
            console.log(err);
            return new Result<Gallery>(new Error('등록에 실패하였습니다.'),400);
        }
    }

    async save(): Promise<boolean> {
        const db = new Database<Gallery>(Gallery);
        return await db.save(this);
    }

    static async getGalleryByUsername(username: string): Promise<Gallery | undefined> {
        const db = new Database<Gallery>(Gallery);
        return await db.get({ username });
    }

    static async getGalleryBySort(sort: string): Promise<Gallery | undefined> {
        const db = new Database<Gallery>(Gallery);
        return await db.get({ sort });
    }

}