import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class IntIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('ID phải là số nguyên từ 1 đến 2147483647.');
    }
    return id;
  }
}
