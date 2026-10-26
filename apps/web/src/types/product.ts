export type CategoryId =
  | 'coffee'
  | 'tea'
  | 'milk-tea'
  | 'smoothie'
  | 'cake'
  | 'other';

export type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number;
  isAvailable: boolean;
  category: CategoryId;
};