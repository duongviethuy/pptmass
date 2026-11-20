import type { Prayer, Song } from "@/lib/pptmass-types";

export const songLibrary: Song[] = [
  {
    id: "song-di-ve-nha-chua",
    title: "Đi Về Nhà Chúa",
    author: "Thái Nguyên",
    categories: ["Nhập lễ"],
    topics: ["Thường Niên"],
    tags: ["Nhập lễ", "Mùa thường niên"],
    createdAt: "2023-08-12T08:00:00Z",
    updatedAt: "12/08/2023",
    createdByName: "Ban Truyền thông Long Thọ",
    updatedByName: "Ban Truyền thông Long Thọ",
    parts: [
      {
        id: "verse-1",
        kind: "verse",
        label: "Phiên khúc 1",
        lyrics: "Đi về nhà Chúa bao năm cách xa nhan Ngài.\nĐi về nhà Chúa tâm tư sướng vui ngợp trời.\nĐi về nhà Chúa bao nhiêu mến thương đầy vơi.",
      },
      {
        id: "chorus",
        kind: "chorus",
        label: "Điệp khúc",
        lyrics: "Hân hoan, hân hoan vào thánh điện Ngài.\nDâng lên, dâng lên một bài ca mới.\nTôn vinh Thiên Chúa đất trời, tạo hóa muôn loài.",
      },
    ],
  },
  {
    id: "song-tien-dang-len",
    title: "Tiến Dâng Lên",
    categories: ["Dâng lễ"],
    topics: ["Thường Niên"],
    tags: ["Dâng lễ"],
    createdAt: "2023-08-04T08:00:00Z",
    updatedAt: "04/08/2023",
    createdByName: "Ban Truyền thông Long Thọ",
    updatedByName: "Ban Truyền thông Long Thọ",
    parts: [],
  },
  {
    id: "song-cho-con-vung-tin",
    title: "Cho Con Vững Tin",
    categories: ["Hiệp lễ"],
    topics: ["Thường Niên"],
    tags: ["Hiệp lễ"],
    createdAt: "2023-08-09T08:00:00Z",
    updatedAt: "09/08/2023",
    createdByName: "Ban Truyền thông Long Thọ",
    updatedByName: "Ban Truyền thông Long Thọ",
    parts: [],
  },
];

export const demoPrayers: Prayer[] = [
  {
    id: "prayer-truyen-tin",
    title: "KINH TRUYỀN TIN",
    content:
      "Xướng: Đức Chúa Trời sai Thánh Thiên Thần truyền tin cho Rất Thánh Đức Bà Maria.\n\nĐáp: Và Rất Thánh Đức Bà chịu thai bởi phép Đức Chúa Thánh Thần.\n\nKính mừng Maria đầy ơn phúc Đức Chúa Trời ở cùng Bà...",
    updatedAt: "2023-08-13T08:00:00Z",
    createdByName: "Ban Quản trị",
  },
  {
    id: "prayer-lay-cha",
    title: "KINH LẠY CHA",
    content:
      "Lạy Cha chúng con ở trên trời, chúng con nguyện danh Cha cả sáng,\nnước Cha trị đến, ý Cha thể hiện dưới đất cũng như trên trời.\n\nXin Cha cho chúng con hôm nay lương thực hằng ngày,\nvà tha nợ chúng con như chúng con cũng tha kẻ có nợ chúng con.\n\nXin chớ để chúng con sa chước cám dỗ, nhưng cứu chúng con cho khỏi sự dữ. Amen.",
    updatedAt: "2023-08-13T08:00:00Z",
    createdByName: "Ban Quản trị",
  },
  {
    id: "prayer-tin-kinh",
    title: "KINH TIN KÍNH",
    content:
      "Tôi tin kính Đức Chúa Trời là Cha phép tắc vô cùng dựng nên trời đất.\n\nTôi tin kính Đức Chúa Giêsu Kitô là Con Một Đức Chúa Cha cùng là Chúa chúng tôi...",
    updatedAt: "2023-08-13T08:00:00Z",
    createdByName: "Ban Quản trị",
  },
];
