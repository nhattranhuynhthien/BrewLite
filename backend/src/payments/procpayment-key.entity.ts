import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('procpayment_keys')
export class ProcPaymentKeyEntity {
  @PrimaryColumn()
  key: string;

  @Column({ default: 'PROCESSING' })
  status: string; // 'PROCESSING', 'SUCCESS', 'FAILED'

  @Column({ type: 'jsonb', nullable: true })
  result: any;

  @CreateDateColumn()
  createdAt: Date;
}