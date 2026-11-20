export { cn } from "cn";

/** Chuẩn hóa chuỗi tiếng Việt: xóa khoảng trắng thừa và viết hoa chữ cái đầu mỗi từ. */
export function toTitleCaseVi(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\p{L}+/gu, (word) => {
      const lower = word.toLocaleLowerCase("vi-VN");
      return lower.charAt(0).toLocaleUpperCase("vi-VN") + lower.slice(1);
    });
}
