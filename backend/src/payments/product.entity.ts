// src/payments/product.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('int')
  stock: number;

  @VersionColumn() // PostgreSQL tự động tăng version này lên 1 sau mỗi lần update thành công
  version: number;
}