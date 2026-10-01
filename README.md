# Tiền nhà

Web app nhỏ để chia tiền nhà, điện, nước… cho nhà ở ghép, dữ liệu lưu trên **Google Sheets**, deploy miễn phí trên **Vercel**.

- Mỗi tháng nhập các khoản chi (tiền nhà, điện, nước, phí quản lý, gửi xe, khác), app tự chia cho từng người
- **Chia đều** cho những người được chọn, hoặc **chia riêng** từng người (vd. phòng to đóng nhiều hơn)
- Ghi lại **ai đã trả tiền trước** để được trừ khi đóng
- Khoản **giảm trừ** (vd. chủ nhà giảm tiền), đánh dấu **đã đóng** cho từng người
- **Gửi nhóm**: tạo sẵn tin nhắn tổng kết để dán vào Zalo/Messenger
- Sao chép khoản cố định từ tháng trước, xem **lịch sử** các tháng
- Giao diện mobile‑first, chế độ sáng/tối, thêm được ra màn hình chính như app

## Cách tính

```
Phần của mỗi người = tổng các phần được chia cho người đó
Cần đóng           = Phần của mỗi người − số tiền người đó đã trả trước cho nhà
```

Số tiền nhập theo đơn vị **nghìn đồng (k)**, giống sheet cũ.

## Dữ liệu trên Google Sheets

App tự tạo 3 tab (không đụng tới các tab khác có sẵn trong file):

| Tab        | Cột                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- |
| `members`  | ID · Tên · Đang ở                                                                            |
| `expenses` | ID · Tháng · Loại · Tên khoản · Số tiền (k) · Người ứng · Cách chia · Chia cho · Ghi chú · … |
| `months`   | Tháng · Ghi chú · Đã đóng · Sửa lúc                                                          |

`Cách chia` là `đều` (Chia cho = `id1, id2`) hoặc `riêng` (Chia cho = `id1: 1800, id2: 3100`).

## Cài đặt

### 1. Service account Google

1. Vào [Google Cloud Console](https://console.cloud.google.com) → tạo project
2. **APIs & Services → Library** → bật **Google Sheets API**
3. **IAM & Admin → Service Accounts** → tạo service account → tab **Keys** → **Add key → JSON**
4. Mở Google Sheet → **Share** → thêm email của service account với quyền **Editor**

### 2. Chạy trên máy

```bash
npm install
cp .env.example .env.local   # điền GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_FILE, APP_PASSCODE
npm run dev
```

Nếu chưa cấu hình Google Sheets, bản dev sẽ tự dùng file `.data/db.json` để thử.

### 3. Deploy lên Vercel

Import repo trên [vercel.com/new](https://vercel.com/new) và thêm Environment Variables:

| Biến                          | Giá trị                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `GOOGLE_SHEET_ID`             | ID của sheet (đoạn giữa `/d/` và `/edit` trong link)          |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | dán nguyên nội dung file JSON key                             |
| `APP_PASSCODE`                | mã truy cập chung cho cả nhà (để trống = không cần đăng nhập) |

## Script

```bash
npm run sheet:pull -- backup.json   # sao lưu dữ liệu từ sheet ra file JSON
npm run sheet:push -- data.json     # ghi đè 3 tab của app bằng file JSON
```

## Công nghệ

Next.js (App Router) · React · Tailwind CSS · SWR · Google Sheets API (REST, service account)
