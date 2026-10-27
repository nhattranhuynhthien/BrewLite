import type { CategoryId, Product } from '@/types/product';

export const CATEGORIES: { id: CategoryId; label: string; title: string }[] = [
  { id: 'coffee', label: 'Cà phê', title: 'Cà phê' },
  { id: 'tea', label: 'Trà', title: 'Trà' },
  { id: 'milk-tea', label: 'Trà sữa', title: 'Trà sữa' },
  { id: 'smoothie', label: 'Sinh tố', title: 'Sinh tố' },
  { id: 'cake', label: 'Bánh', title: 'Bánh' },
  { id: 'other', label: 'Khác', title: 'Khác' },
];

const PHOTO_IMAGES = new Set([
  'ca-phe-den-da',
  'ca-phe-sua-da',
  'cappuccino',
  'ca-phe-caramel',
  'americano',
  'tra-dao',
  'tra-vai',
  'tra-tac',
  'tra-xanh-matcha',
  'tra-o-long',
]);

const img = (name: string) => `/img/menu/${name}.${PHOTO_IMAGES.has(name) ? 'png' : 'svg'}`;

const item = (
  id: number,
  name: string,
  price: number,
  image: string | null,
  category: CategoryId,
): Product => ({
  id,
  name,
  description: null,
  price,
  imageUrl: image ? img(image) : null,
  stock: 100,
  isAvailable: true,
  category,
});

// Dữ liệu mẫu — sau này thay bằng API / database
export const PRODUCTS: Product[] = [
  item(1, 'Cà phê đen đá', 25000, 'ca-phe-den-da', 'coffee'),
  item(2, 'Cà phê sữa đá', 28000, 'ca-phe-sua-da', 'coffee'),
  item(3, 'Cà phê cappuccino', 35000, 'cappuccino', 'coffee'),
  item(4, 'Cà phê caramel', 38000, 'ca-phe-caramel', 'coffee'),
  item(5, 'Americano', 30000, 'americano', 'coffee'),

  item(6, 'Trà đào', 28000, 'tra-dao', 'tea'),
  item(7, 'Trà vải', 28000, 'tra-vai', 'tea'),
  item(8, 'Trà tắc', 25000, 'tra-tac', 'tea'),
  item(9, 'Trà xanh matcha', 32000, 'tra-xanh-matcha', 'tea'),
  item(10, 'Trà ô long', 30000, 'tra-o-long', 'tea'),

  // Trà sữa
  item(11, 'Trà sữa truyền thống', 30000, 'tra-sua-truyen-thong', 'milk-tea'),
  item(12, 'Trà sữa trân châu đường đen', 38000, 'tra-sua-tran-chau-duong-den', 'milk-tea'),
  item(13, 'Trà sữa matcha', 40000, 'tra-sua-matcha', 'milk-tea'),
  item(14, 'Trà sữa khoai môn', 38000, 'tra-sua-khoai-mon', 'milk-tea'),
  item(15, 'Trà sữa socola', 38000, 'tra-sua-socola', 'milk-tea'),
  item(16, 'Trà sữa Thái xanh', 35000, 'tra-sua-thai-xanh', 'milk-tea'),
  item(17, 'Trà sữa Hokkaido', 40000, 'tra-sua-hokkaido', 'milk-tea'),
  item(18, 'Trà sữa ô long', 38000, 'tra-sua-o-long', 'milk-tea'),
  item(19, 'Trà sữa dâu', 36000, 'tra-sua-dau', 'milk-tea'),
  item(20, 'Trà sữa kem cheese', 42000, 'tra-sua-kem-cheese', 'milk-tea'),

  // Sinh tố
  item(21, 'Sinh tố bơ', 40000, 'sinh-to-bo', 'smoothie'),
  item(22, 'Sinh tố xoài', 38000, 'sinh-to-xoai', 'smoothie'),
  item(23, 'Sinh tố dâu', 38000, 'sinh-to-dau', 'smoothie'),
  item(24, 'Sinh tố chuối', 32000, 'sinh-to-chuoi', 'smoothie'),
  item(25, 'Sinh tố mãng cầu', 40000, 'sinh-to-mang-cau', 'smoothie'),
  item(26, 'Sinh tố việt quất', 45000, 'sinh-to-viet-quat', 'smoothie'),
  item(27, 'Sinh tố dưa hấu', 30000, 'sinh-to-dua-hau', 'smoothie'),
  item(28, 'Sinh tố cam cà rốt', 35000, 'sinh-to-cam-ca-rot', 'smoothie'),
  item(29, 'Sinh tố sapôchê', 38000, 'sinh-to-sapoche', 'smoothie'),
  item(30, 'Sinh tố thanh long', 35000, 'sinh-to-thanh-long', 'smoothie'),

  // Bánh
  item(31, 'Bánh tiramisu', 45000, 'banh-tiramisu', 'cake'),
  item(32, 'Bánh mousse chanh dây', 42000, 'banh-mousse-chanh-day', 'cake'),
  item(33, 'Bánh su kem', 25000, 'banh-su-kem', 'cake'),
  item(34, 'Bánh croissant bơ', 30000, 'banh-croissant-bo', 'cake'),
  item(35, 'Bánh flan caramel', 20000, 'banh-flan-caramel', 'cake'),
  item(36, 'Bánh brownie socola', 35000, 'banh-brownie-socola', 'cake'),
  item(37, 'Bánh cheesecake việt quất', 48000, 'banh-cheesecake-viet-quat', 'cake'),
  item(38, 'Bánh bông lan trứng muối', 35000, 'banh-bong-lan-trung-muoi', 'cake'),
  item(39, 'Bánh cookie socola chip', 20000, 'banh-cookie-socola-chip', 'cake'),
  item(40, 'Bánh red velvet', 45000, 'banh-red-velvet', 'cake'),
];