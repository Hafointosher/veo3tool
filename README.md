# 🚀 Auto Flow Pro v8.0.0

**Tự động hóa quy trình tạo video hàng loạt trên Google VEO AI**

![Version](https://img.shields.io/badge/version-8.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

---

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Cài đặt](#-cài-đặt)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Changelog](#-changelog)

---

## ✨ Tính năng

### 🎯 Core Features
- **Text-to-Video**: Tự động submit hàng loạt prompts văn bản
- **Image-to-Video**: Tự động upload ảnh và tạo video
- **Auto Download**: Tự động tải video khi hoàn thành
- **Progress Tracking**: Theo dõi tiến trình real-time

### 🔧 Advanced Features
- **Smart Queue Management**
  - FIFO (First In First Out)
  - Priority-based ordering
  - Short prompts first
  - Shuffle/Random
  
- **Prompt Enhancer**
  - Cinematic style
  - Anime style
  - Realistic style
  - Vintage style
  - Auto-generate variations

- **Rate Limiting**
  - Configurable requests per minute/hour
  - Automatic batch pausing
  - Smart cooldown

- **Retry Mechanism**
  - Automatic retry on failure
  - Exponential backoff
  - Configurable max retries

### 📊 Dashboard
- Real-time statistics
- ETA calculation
- Progress timeline
- Video gallery
- Activity logs

### ⏰ Scheduler
- Schedule jobs for later
- Repeat options (hourly, daily, weekly)
- Profile import/export
- Webhook notifications

### 🔔 Notifications
- Desktop notifications
- Webhook support (Discord, Slack, etc.)
- Custom event triggers

---

## 📦 Cài đặt

### Yêu cầu
- Google Chrome phiên bản 116 trở lên
- Quyền truy cập vào https://labs.google

### Các bước cài đặt

1. **Clone/Download repository**
   ```bash
   git clone <repository-url>
   # hoặc download ZIP và giải nén
   ```

2. **Mở Chrome Extensions**
   - Truy cập `chrome://extensions/`
   - Bật **Developer mode** (góc trên bên phải)

3. **Load extension**
   - Click **Load unpacked**
   - Chọn thư mục `veo`

4. **Xác nhận cài đặt**
   - Extension sẽ xuất hiện trong danh sách
   - Icon sẽ hiện trên thanh công cụ

---

## 📖 Hướng dẫn sử dụng

### Bắt đầu nhanh

1. **Mở trang VEO AI**
   - Truy cập https://labs.google
   - Đăng nhập tài khoản Google

2. **Mở Side Panel**
   - Click icon extension trên thanh công cụ
   - Hoặc nhấn `Ctrl+Shift+B`

3. **Import prompts**
   - Click **Nhập Txt** để import file
   - Hoặc click **Thêm** để nhập thủ công
   - Mỗi dòng = 1 prompt

4. **Cấu hình**
   - Chọn **Model** (Veo 3.1, Veo 2)
   - Chọn **Tỷ lệ** (16:9, 9:16, 1:1)
   - Chọn **Số lượng** videos per prompt

5. **Chạy**
   - Click **BẮT ĐẦU CHẠY**
   - Theo dõi tiến trình trên Dashboard

### Text-to-Video Mode

| Nút | Chức năng |
|-----|-----------|
| Nhập Txt | Import file .txt (mỗi dòng = 1 prompt) |
| Thêm | Nhập thủ công nhiều prompts |
| Enhance | Tự động thêm style vào prompts |
| Xóa hết | Xóa tất cả prompts |

**Drag & Drop**: Kéo thả để thay đổi thứ tự prompts

**Priority**: Click Edit để đặt priority (High/Normal/Low)

### Image-to-Video Mode

1. Click **Chọn Ảnh** để chọn nhiều ảnh
2. Click **Nạp Prompt** để import file txt
3. Prompts sẽ được gán theo thứ tự cho từng ảnh
4. Sắp xếp A-Z hoặc Z-A

### Dashboard

- **Stats**: Tổng quan tiến trình
- **ETA**: Ước tính thời gian hoàn thành
- **Rate**: Số requests/phút
- **Timeline**: Tiến trình từng task
- **Video Gallery**: Xem và tải videos
- **Logs**: Chi tiết hoạt động

### Scheduler

1. Chọn thời gian bắt đầu
2. Chọn repeat (nếu cần)
3. Click **Lên lịch chạy**

### Webhook

1. Dán URL webhook (Discord, Slack, etc.)
2. Chọn events muốn nhận thông báo
3. Click **Lưu Webhook**

**Ví dụ Discord Webhook:**
```
https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
```

---

## 🗂 Cấu trúc dự án

```
veo/
├── manifest.json       # Cấu hình extension
├── background.js       # Service worker
├── content.js          # Script tương tác với trang
├── panel.html          # UI Side Panel
├── panel.js            # Logic Side Panel
├── panel.css           # Styles
├── icons/
│   └── icon128.png     # Icon extension
└── README.md           # Hướng dẫn
```

### Modules trong content.js

| Module | Mô tả |
|--------|-------|
| Logger | Logging system |
| SelectorEngine | Dynamic element finder |
| RateLimiter | Request throttling |
| withRetry | Retry mechanism |
| waitForElement | Wait for DOM elements |

### Modules trong panel.js

| Module | Mô tả |
|--------|-------|
| PromptEnhancer | Prompt styling |
| SmartQueue | Queue strategies |
| Dashboard | Stats & monitoring |
| Scheduler | Job scheduling |
| Webhook | Notifications |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl + Enter` | Bắt đầu chạy |
| `Escape` | Dừng queue / Đóng modal |

---

## ⚙️ Settings nâng cao

Click icon ⚙️ Settings để mở cài đặt:

- **Rate Limiting**
  - Max requests/minute
  - Max requests/hour

- **Retry Settings**
  - Max retries
  - Retry delay (ms)

- **Notifications**
  - Thông báo khi hoàn thành
  - Thông báo khi có lỗi

---

## 🔄 Changelog

### v8.0.0 (January 2026)
- ✨ **NEW**: Dashboard với real-time stats
- ✨ **NEW**: Video Gallery
- ✨ **NEW**: Scheduler với repeat options
- ✨ **NEW**: Webhook notifications
- ✨ **NEW**: Prompt Enhancer với 4 styles
- ✨ **NEW**: Smart Queue strategies
- ✨ **NEW**: Drag & Drop reordering
- ✨ **NEW**: Profile import/export
- 🔧 **FIX**: Missing `findAllPromptContainers` function
- 🔧 **FIX**: Rate limiting
- 🔧 **FIX**: Retry mechanism với exponential backoff
- 🔧 **FIX**: Dynamic selector engine
- 🎨 **UI**: Complete redesign với modern aesthetics
- 📝 **DOCS**: Comprehensive README

### v7.7.7 (Previous)
- Initial release

---

## 🐛 Troubleshooting

### Extension không hoạt động
1. Đảm bảo đang ở trang https://labs.google
2. Refresh trang và thử lại
3. Kiểm tra Console (F12) để xem lỗi

### Không tìm thấy element
- Extension sử dụng Dynamic Selector Engine
- Nếu Google thay đổi UI, có thể cần update selectors
- Kiểm tra logs trong Dashboard

### Rate limit
- Giảm batch size
- Tăng rest time giữa các batches
- Kiểm tra quota trên Google VEO

---

## 📄 License

MIT License - Free for personal and commercial use.

---

## 🙏 Credits

Developed with ❤️ for the VEO AI community.
