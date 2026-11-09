// One consistent line-icon set (24px grid, 1.6 stroke). No emoji anywhere in the product.
const S = ({ children, size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
    {children}
  </svg>
);

export const IMic = (p) => <S {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></S>;
export const IStop = (p) => <S {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" /></S>;
export const IArrowRight = (p) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const IArrowLeft = (p) => <S {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></S>;
export const IArrowUp = (p) => <S {...p}><path d="M12 19V5M6 11l6-6 6 6" /></S>;
export const IArrowDown = (p) => <S {...p}><path d="M12 5v14M6 13l6 6 6-6" /></S>;
export const ICheck = (p) => <S {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IX = (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const ITrash = (p) => <S {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></S>;
export const ICopy = (p) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></S>;
export const ILink = (p) => <S {...p}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></S>;
export const IEye = (p) => <S {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>;
export const ISpeaker = (p) => <S {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></S>;
export const IHeadset = (p) => <S {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></S>;
export const IDownload = (p) => <S {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></S>;
export const IMail = (p) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></S>;
export const IChat = (p) => <S {...p}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" /></S>;
export const IDoc = (p) => <S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></S>;
export const IInbox = (p) => <S {...p}><path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></S>;
export const IUser = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></S>;
export const IDuplicate = (p) => <S {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></S>;
export const IShare = (p) => <S {...p}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></S>;
export const IReturn = (p) => <S {...p}><path d="M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4" /></S>;
export const IPen = (p) => <S {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></S>;
export const IUpload = (p) => <S {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></S>;
export const ISection = (p) => <S {...p}><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></S>;
export const IShuffle = (p) => <S {...p}><path d="M4 7h3c4 0 6 10 10 10h3M17 14l3 3-3 3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M13.1 9.6C14.2 8.4 15.4 7 17 7h3M17 4l3 3-3 3" /></S>;
export const IPrint = (p) => <S {...p}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></S>;
export const ISun = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></S>;
export const IMoon = (p) => <S {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></S>;
