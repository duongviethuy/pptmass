export type SectionKind = "image" | "text" | "song" | "prayer";
export type SongPartKind = "verse" | "chorus" | "bridge";

export type SongPart = {
  id: string;
  kind: SongPartKind;
  label: string;
  lyrics: string;
};

export type Song = {
  id: string;
  title: string;
  author?: string;
  notes?: string;
  /** Đường dẫn tệp PDF tờ nhạc lưu trên Bunny CDN (nếu có). */
  pdfUrl?: string;
  isPublic?: boolean;
  categories?: string[];
  topics?: string[];
  tags: string[];
  parts: SongPart[];
  createdAt?: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
};

export type Prayer = {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
};

export type SlideTextAlign = "justify" | "center" | "left";
export type SlideFontFamily = "Arial" | "Times New Roman" | "Calibri" | "Georgia" | "Tahoma" | "Verdana";

export type TextStyle = {
  fontSize: "medium" | "large" | "xlarge";
  /** Cỡ chữ tùy chỉnh theo point (pt). Khi có giá trị, ưu tiên dùng thay cho preset fontSize. */
  fontSizePt?: number;
  /** Khoảng cách dòng (line spacing) tùy chỉnh của nội dung theo point (pt). */
  lineSpacingPt?: number;
  /** Font chữ hiển thị trên slide. Mặc định "Arial". */
  fontFamily?: SlideFontFamily;
  /** Căn lề nội dung trên slide. Mặc định là "justify" (căn đều 2 biên). */
  textAlign?: SlideTextAlign;
  /** Màu chữ nội dung tùy chỉnh (#HEX). */
  contentColor?: string;
  /** Font chữ tiêu đề tùy chỉnh. */
  titleFontFamily?: SlideFontFamily;
  /** Cỡ chữ tiêu đề tùy chỉnh theo pt. */
  titleFontSizePt?: number;
  /** Khoảng cách dòng (line spacing) tùy chỉnh của tiêu đề theo point (pt). */
  titleLineSpacingPt?: number;
  /** Căn lề tiêu đề trên slide. Mặc định "center". */
  titleAlign?: SlideTextAlign;
  /** Màu chữ tiêu đề tùy chỉnh (#HEX). */
  titleColor?: string;
  showTitleOnEverySlide: boolean;
  /** Mặc định true cho bài hát: hiện số câu/ký hiệu ở trước câu hát (ĐK:, 1., 2., ...). */
  showPartPrefix?: boolean;
};

export type TextCustomSlide = {
  id: string;
  content: string;
};

export type ImageFitMode = "cover" | "contain";
export type ImageCategory = "cover" | "reading" | "other";

export type SlideBackgroundImage = {
  url: string;
  /** Độ rõ / không trong suốt của ảnh nền tính theo phần trăm (0 - 100). */
  opacity: number;
  fit?: ImageFitMode;
};

/**
 * Một slide chỉnh sửa trực tiếp kiểu PowerPoint bên trong section (không tự nhảy chữ khi đang sửa).
 */
export type EditableSlideItem = {
  id: string;
  /** Nhãn nguồn cho slide bài hát (VD: "Điệp khúc", "Phiên khúc 1"). */
  partLabel?: string;
  /** Tiêu đề riêng của slide (mặc định đồng bộ theo tiêu đề section nếu không đặt riêng). */
  heading?: string;
  /** Ẩn/hiện tiêu đề trên slide này. */
  showHeading?: boolean;
  /** Tiêu đề phụ hiển thị bên dưới tiêu đề chính trên Slide tiêu đề. */
  subheading?: string;
  /** Ẩn/hiện trường tiêu đề phụ trên Slide tiêu đề (bật bằng nút +, tắt bằng nút x). */
  showSubheading?: boolean;
  /** Ký hiệu đầu câu hát (VD: "ĐK:", "1.", "2."). */
  bodyPrefix?: string;
  /** Nội dung văn bản cố định của slide này. */
  body: string;
  /** Ẩn/hiện nội dung trên slide này. */
  showBody?: boolean;
  /** Ảnh nền riêng cho slide này (có thể đồng bộ cho toàn bộ section). */
  backgroundImage?: SlideBackgroundImage;
  /** `true` nếu slide này thuộc cùng luồng văn bản tràn từ slide trước (tự chảy qua/chảy về 2 chiều). */
  flowWithPrev?: boolean;
  /** Ký tự ngăn cách gốc giữa slide trước và slide này trong luồng văn bản ("", " " hoặc "\n"). */
  joinSeparator?: "" | " " | "\n";
};

export type ImageSection = {
  id: string;
  kind: "image";
  title: string;
  savedSectionId?: string;
  imageCategory?: ImageCategory;
  imageUrl?: string;
  imageFit?: ImageFitMode;
};
export type TextSection = {
  id: string;
  kind: "text";
  title: string;
  savedSectionId?: string;
  content: string;
  extraSlides?: TextCustomSlide[];
  /** Danh sách slide chỉnh sửa trực tiếp (khi có, hiển thị & xuất 1:1 không tự nhảy chữ). */
  slides?: EditableSlideItem[];
  showTitle?: boolean;
  showContent?: boolean;
  titleFontFamily?: SlideFontFamily;
  titleFontSize?: TextStyle["fontSize"];
  titleFontSizePt?: number;
  titleLineSpacingPt?: number;
  titleAlign?: SlideTextAlign;
  titleColor?: string;
  contentColor?: string;
  /** Giao diện nền slide riêng cho section này (nếu không đặt sẽ dùng giao diện chung của bài trình chiếu). */
  themeId?: MassThemeId;
  customTheme?: CustomSlideTheme;
  style: TextStyle;
};
export type PrayerSection = {
  id: string;
  kind: "prayer";
  title: string;
  savedSectionId?: string;
  prayerId?: string;
  content: string;
  /** Danh sách slide chỉnh sửa trực tiếp (chia 1 lần khi chọn kinh, sau đó chỉnh tay hoàn toàn). */
  slides?: EditableSlideItem[];
  /** Giao diện nền slide riêng cho section này. */
  themeId?: MassThemeId;
  customTheme?: CustomSlideTheme;
  style: TextStyle;
};
/** A song section stores presentation metadata & editable slides imported from the Song library. */
export type SongSection = {
  id: string;
  kind: "song";
  title: string;
  savedSectionId?: string;
  songId: string;
  partOrder?: string[];
  /** Danh sách slide chỉnh sửa trực tiếp (đổ lời từ thư viện 1 lần, sau đó sửa trực tiếp không tự nhảy chữ). */
  slides?: EditableSlideItem[];
  /** Giao diện nền slide riêng cho section này. */
  themeId?: MassThemeId;
  customTheme?: CustomSlideTheme;
  style: TextStyle;
};

export type MassSection = ImageSection | TextSection | PrayerSection | SongSection;

export type SavedSection = {
  id: string;
  title: string;
  kind: SectionKind;
  sectionData: MassSection;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type SlideAspectRatio = "16:9" | "4:3";

export type MassThemeId = "pure-white" | "warm-light" | "lenten-violet" | "feast-red" | "custom";

export type CustomSlideTheme = {
  mode: "solid" | "gradient";
  colorFrom: string;
  colorTo: string;
  angle: number;
  textColor: "light" | "dark";
};

export type Mass = {
  id: string;
  title: string;
  celebrationDate: string;
  liturgicalSeason?: string;
  parishName?: string;
  aspectRatio: SlideAspectRatio;
  themeId: MassThemeId;
  customTheme?: CustomSlideTheme;
  isPublic: boolean;
  copiedFromId?: string;
  copiedFromAuthor?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt?: string;
  updatedAt?: string;
  sections: MassSection[];
};

/** Bản tóm tắt nhẹ của một bài trình chiếu đã lưu trong bảng `public.slides` (dùng cho danh sách & trang chủ). */
export type SavedSlideSummary = {
  id: string;
  title: string;
  celebrationDate: string;
  aspectRatio: SlideAspectRatio;
  themeId: MassThemeId;
  sectionCount: number;
  slideCount: number;
  coverImageUrl?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
