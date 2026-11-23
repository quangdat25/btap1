# Techcamp — Hệ thống học từ vựng tiếng Anh

Ứng dụng được hoàn thiện trực tiếp từ dự án **ReactJS + Vite** ban đầu trong thư mục `study#`, dựa trên bộ tài liệu yêu cầu, khảo sát, BRD và SRS Techcamp. Giao diện tiếng Việt, nội dung học tiếng Anh có nghĩa và ví dụ tiếng Việt.

Giao diện chỉ dùng ReactJS và CSS thuần. Phần lưu trữ, xác thực, phân quyền và chấm bài dùng **Node.js HTTP thuần + SQLite tích hợp trong Node**. Không dùng Next.js, Vue, Angular, Express hoặc framework giao diện khác. ExcelJS xử lý tệp Excel, Nodemailer phục vụ SMTP; Playwright chỉ dùng để kiểm thử.

## Chạy trên máy

Nếu lấy mã từ GitHub, mở terminal tại thư mục bạn muốn lưu dự án:

```powershell
git clone https://github.com/quangdat25/btap1.git
cd btap1
npm install
npm run dev
```

Yêu cầu Node.js **22.21 trở lên**. Mở PowerShell:

```powershell
cd 'D:\juniorBA\Bai1\study#'
npm install
npm run dev
```

Mở **http://127.0.0.1:5173**. Một lệnh khởi động cả giao diện và API tại cổng 3001. Cần để cửa sổ terminal tiếp tục chạy; nhấn Ctrl+C để dừng.

Tên thư mục có ký tự `#` không tương thích với cách Vite xử lý đường dẫn. `scripts/dev.mjs` tự tạo một junction/symlink trong thư mục tạm và bật giữ đường dẫn symlink cho Vite. Mã nguồn vẫn nằm nguyên trong `study#`, không bị sao chép hoặc di chuyển. Dùng `npm run dev` để có cách xử lý này.

### Tài khoản mẫu

| Vai trò       | Email                    | Mật khẩu        |
| ------------- | ------------------------ | --------------- |
| Người học     | `learner@techcamp.local` | `Techcamp@2026` |
| Quản trị viên | `admin@techcamp.local`   | `Techcamp@2026` |

Các nút **Người học** và **Quản trị viên** trên màn hình đăng nhập điền sẵn tài khoản tương ứng. Dữ liệu ban đầu có 6 chủ đề, 6 bộ từ và 56 từ do nhóm phát triển biên soạn làm mẫu. Không tạo điểm số hoặc lịch sử học giả. Nội dung mẫu cần người phụ trách tiếng Anh rà soát trước khi dùng chính thức.

### Đăng ký và quên mật khẩu khi chạy trên máy

1. Đăng ký với tên, email và mật khẩu từ 12 đến 128 ký tự.
2. Chọn **Mở hộp thư thử nghiệm**, rồi mở thư kích hoạt.
3. Nhấn **Kích hoạt tài khoản**, sau đó đăng nhập.
4. Luồng **Quên mật khẩu** cũng nhận liên kết trong hộp thư thử nghiệm.

Hộp thư chỉ có ở chế độ phát triển. Liên kết kích hoạt hết hạn sau 24 giờ, khôi phục sau 15 phút, mỗi liên kết dùng một lần. Gửi lại sẽ thu hồi liên kết cũ. Chế độ phát triển không gửi email tới địa chỉ bên ngoài.

## Chức năng đã triển khai

### Người học

- Đăng ký, kích hoạt, đăng nhập, đăng xuất, đặt lại và đổi mật khẩu.
- Dashboard với mục tiêu ngày, số từ khác nhau đã luyện, từ đến hạn, tỷ lệ đúng, chuỗi ngày học và biểu đồ 7 ngày. Chỉ số tính từ dữ liệu được lưu.
- Tìm kiếm bộ từ, lọc theo chủ đề/trình độ, phân trang và xem chi tiết nội dung.
- Flashcard: lật thẻ, chuyển từ, phiên âm, nghĩa, ví dụ, phát âm, lưu từ và đánh dấu từ khó. Có chế độ chỉ xem từ khó.
- Bài luyện **chọn nghĩa đúng**, **nhập từ tiếng Anh** hoặc kết hợp; chọn 1–20 từ mỗi phiên.
- Học mới, ôn đến hạn, luyện thêm; tiếp tục phiên đang học sau tải lại. Đổi phiên cần xác nhận kết thúc phiên cũ.
- Chấm trên máy chủ, phản hồi từng câu, kết quả tổng hợp, danh sách câu sai và thời điểm ôn tiếp theo.
- Bộ sưu tập cá nhân: lưu/bỏ lưu, tìm kiếm, lọc từ khó; bỏ lưu không xóa tiến độ.
- Lịch sử có lọc ngày, chế độ, trạng thái và xuất `.xlsx` theo tài khoản.
- Hồ sơ, mục tiêu 1–100 từ/ngày, múi giờ và nhắc học trong tài khoản. Mục tiêu/múi giờ mới có hiệu lực ngày sau.
- Giao diện thích ứng máy tính và điện thoại; menu di động, biểu mẫu có nhãn, dialog hỗ trợ bàn phím và trạng thái rỗng/lỗi.

### Quản trị

- Thêm/sửa chủ đề, bộ từ, từ vựng, câu hỏi, danh sách đáp án nhập từ, giải thích và nguồn nội dung.
- Nội dung có trạng thái nháp, xuất bản, lưu trữ. Bộ từ cần có từ đã xuất bản trước khi xuất bản bộ.
- Một nghĩa từ có thể liên kết nhiều bộ. Mã từ và tổ hợp từ/loại từ/mã nghĩa được kiểm tra trùng.
- Mỗi lần sửa từ tạo phiên bản; phiên học cũ chấm và hiển thị đúng nội dung đã chốt.
- Quản lý trạng thái/vai trò tài khoản; thu hồi phiên cũ sau thay đổi; ngăn vô hiệu quản trị viên hoạt động cuối cùng.
- Nhập Excel có tệp mẫu, chế độ tạo mới/cập nhật, kiểm tra từng dòng, xem trước, xác nhận cả lô và chống nhập lặp. Dữ liệu nhập ở trạng thái nháp.
- Báo cáo lọc thời gian/chủ đề, mức tham gia, câu đã chấm, tỷ lệ đúng, lượt trả lời theo chủ đề và tỷ lệ sai theo phiên bản từ; xuất Excel không kèm định danh mặc định.
- Cấu hình lịch ôn và kích thước phiên có phiên bản; thay đổi không tính lại các hạn đã có.
- Nhật ký chỉ đọc của các thay đổi nội dung, quyền, cấu hình, lô nhập và hoạt động xác thực.

### Các quy tắc học quan trọng

- Xem/lật flashcard không ghi điểm, không tăng số từ đã luyện và không thay lịch ôn.
- Mỗi câu chỉ nhận một kết quả: gửi lại cùng nội dung trả kết quả cũ; khác nội dung trả lỗi xung đột.
- Kết quả câu và lịch ôn được ghi cùng một giao dịch SQLite.
- Đúng: tăng bậc, tối đa 5; khoảng ôn mặc định lần lượt **1, 3, 7, 14, 30 ngày**. Sai: bậc 0, ôn sau **10 phút**.
- Luyện thêm không thay lịch. Ôn đến hạn chỉ đổi lịch nếu từ còn đến hạn tại lúc chấm; đến hạn khi `due_at <= now`.
- Học mới chỉ chọn từ chưa có câu trả lời được lưu; một tài khoản chỉ có một phiên đang học.
- Mục tiêu ngày đếm các mã từ khác nhau được trả lời trong ngày, không đếm lần lật thẻ. Tỷ lệ đúng = đúng / đã trả lời, chưa trả lời không bị tính sai.
- Chuẩn hóa câu nhập bằng Unicode NFC, bỏ khoảng trắng đầu/cuối, gộp khoảng trắng và không phân biệt hoa/thường. Giữ dấu câu, dấu nháy và dấu tiếng Việt.
- Thời điểm lưu UTC, giao diện hiển thị theo múi giờ tài khoản. Mục tiêu từng ngày được chụp lại để không viết lại lịch sử.
- “Từ đã luyện” phản ánh hoạt động, không được gọi là “đã thành thạo”.

## Nhập Excel

Vào **Quản trị hệ thống → Nhập Excel → Tải tệp mẫu**.

| Cột           | Bắt buộc | Nội dung                             |
| ------------- | -------- | ------------------------------------ |
| `code`        | Có       | Mã từ duy nhất, tối đa 40 ký tự      |
| `word`        | Có       | Từ tiếng Anh                         |
| `pos`         | Có       | Loại từ                              |
| `sense`       | Không    | Mã nghĩa, mặc định `01`              |
| `ipa`         | Có       | Phiên âm                             |
| `meaning`     | Có       | Nghĩa tiếng Việt                     |
| `example`     | Có       | Ví dụ tiếng Anh                      |
| `translation` | Không    | Dịch ví dụ                           |
| `setCode`     | Có       | Mã bộ từ đã tồn tại, xem ở mục Bộ từ |
| `source`      | Có       | Nguồn nội dung hoặc quyền sử dụng    |
| `accepted`    | Không    | Các đáp án nhập từ, phân cách bằng ` | `; mặc định là `word` |

Tệp phải là `.xlsx`, tối đa 5 MB/2.000 dòng; có kiểm tra cấu trúc ZIP và giới hạn dữ liệu giải nén. Tệp có một dòng lỗi sẽ không được xác nhận nhập. Công thức và đối tượng trong ô bị từ chối; dữ liệu xuất được ghi dạng văn bản thay vì thực thi công thức. Nếu nội dung thay đổi sau khi kiểm tra, cần kiểm tra lại trước khi nhập.

## Build và kiểm thử

```powershell
npm run build
npm start
```

Bản build được API phục vụ tại **http://127.0.0.1:3001**. `npm start` mặc định vẫn là chế độ phát triển cục bộ; không tự bật production hoặc gửi email thật.

```powershell
npm test
npm run test:browser
```

- `npm test`: kiểm tra lịch ôn, phân quyền, băm mật khẩu, chống trùng, phiên bản nội dung, tiếp tục phiên, nhập/xuất Excel, mục tiêu ngày và vòng đời kích hoạt/khôi phục.
- `npm run test:browser`: build và chạy luồng học/quản trị trên Microsoft Edge không mở cửa sổ; kiểm tra không cuộn ngang ở chiều rộng 360px và không lỗi JavaScript. Cần cài Microsoft Edge; có thể đổi `channel` trong script nếu dùng trình duyệt khác.
- Cả hai dùng cơ sở dữ liệu riêng. Ảnh kiểm tra giao diện nằm trong `test-artifacts/`, không được đưa vào mã nguồn khi commit.

## Dữ liệu và sao lưu

SQLite được tự tạo ở `data/techcamp.sqlite`; dữ liệu còn nguyên sau khi tắt/mở ứng dụng. Dữ liệu thử nghiệm, mật khẩu môi trường và bản sao lưu đều được bỏ qua trong `.gitignore`.

```powershell
npm run backup
```

Lệnh tạo một bản sao nhất quán trong `backups/`, kể cả khi ứng dụng đang chạy. Để phục hồi: dừng toàn bộ tiến trình Techcamp, giữ bản dữ liệu hiện tại ở vị trí riêng, rồi thay `data/techcamp.sqlite` bằng bản sao đã chọn. Các tệp `techcamp.sqlite-wal`/`techcamp.sqlite-shm` cũ cũng phải được giữ riêng trước khi mở bản phục hồi. Sau đó mở lại và kiểm tra tài khoản, nội dung, lịch sử. Mã không tự xóa dữ liệu hoặc bản sao cũ.

Sao lưu định kỳ, nơi lưu tách máy, mã hóa, thời hạn giữ và diễn tập phục hồi là cấu hình vận hành cần bổ sung khi triển khai chính thức; chưa tuyên bố đạt SLA/RPO/RTO trong tài liệu yêu cầu.

## Cấu hình email và môi trường chính thức

Sao chép `.env.example` thành `.env`, điền cấu hình của bạn và dùng:

```powershell
node --env-file=.env server/index.mjs
```

- `NODE_ENV=production`: cookie `Secure`, tắt hộp thư thử nghiệm và không tạo tài khoản mẫu trên cơ sở dữ liệu mới.
- `APP_URL`: địa chỉ HTTPS thực tế của giao diện, dùng cho liên kết email và kiểm tra nguồn yêu cầu.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: quản trị viên ban đầu khi cơ sở dữ liệu production còn trống. Mật khẩu tối thiểu 12 ký tự.
- `DB_PATH`: tệp dữ liệu riêng cho production; không sử dụng cơ sở dữ liệu thử có tài khoản mẫu.
- `SMTP_URL`, `MAIL_FROM`: dịch vụ email của bạn. Email được đưa vào hàng đợi lưu trong SQLite, thử gửi lại tối đa 3 lần; liên kết hết hạn hoặc bị thay thế không tiếp tục gửi. Xóa liên kết khỏi hàng đợi sau khi gửi hoặc kết thúc thử lại.
- `API_PORT`, `API_HOST`: địa chỉ lắng nghe. Mặc định chỉ mở trên máy cục bộ.

Nhắc học được kiểm tra mỗi phút khi máy chủ chạy và khi mở Dashboard. Đây là thông báo trong tài khoản, không phải email, push điện thoại hoặc thông báo hệ điều hành.

Mật khẩu được băm scrypt có muối; phiên đăng nhập dùng cookie HttpOnly/SameSite và token băm ở máy chủ. API kiểm tra vai trò và chủ sở hữu. Production cần HTTPS reverse proxy, cấu hình SMTP, bảo vệ tệp dữ liệu và hạ tầng phù hợp. Chưa thực hiện tải thử 100 người đồng thời, nghiệm thu UAT hoặc xác nhận ma trận Safari/Firefox/Android/iOS. Không nên suy ra các chỉ tiêu đó chỉ từ kiểm thử cục bộ.

Phát âm ưu tiên URL HTTPS do quản trị cung cấp. Khi không có tệp, ứng dụng dùng Speech Synthesis của trình duyệt nếu được hỗ trợ; không yêu cầu quyền micro. Giọng đọc và khả năng hoạt động phụ thuộc thiết bị; lỗi phát âm không chặn học phần chữ.

## Cấu trúc mã nguồn

```text
src/
  App.jsx                  Xác thực, điều hướng, bố cục và dữ liệu chung
  lib.jsx                  API, modal, biểu mẫu, thông báo và phát âm
  components/Icon.jsx      Bộ biểu tượng SVG
  pages/Auth.jsx           Đăng nhập/đăng ký/kích hoạt/khôi phục
  pages/Learner.jsx        Dashboard, bộ từ, ôn, từ cá nhân, lịch sử, hồ sơ
  pages/Learning.jsx       Flashcard, phiên luyện tập và kết quả
  pages/Admin.jsx          Nội dung, tài khoản, Excel, báo cáo và cấu hình
server/
  index.mjs                API HTTP, chấm bài, phân quyền và tác vụ nền
  db.mjs                   Schema SQLite, giao dịch, mật khẩu và khởi tạo
  domain.mjs               Chuẩn hóa, lịch ôn và kiểm tra tệp
  seed.mjs                 Nội dung mẫu
scripts/
  dev.mjs                  Chạy React/Vite và API, xử lý tên thư mục có #
  backup.mjs               Sao lưu SQLite
  browser-check.mjs        Kiểm thử trình duyệt và chụp ảnh
tests/system.test.mjs     Kiểm thử API và nghiệp vụ
tests/production.test.mjs Kiểm thử chế độ production với SMTP giả lập cục bộ
```

Phạm vi chọn theo SRS R1: hai dạng bài chọn nghĩa và nhập từ. Ghép từ, nghe rồi nhập, nhận diện giọng nói, đăng nhập liên kết, học phí, lớp học và học ngoại tuyến chưa triển khai. Các dịch vụ email thật, nội dung được xác nhận chuyên môn và chỉ tiêu vận hành cần được cấu hình/kiểm chứng ở môi trường triển khai.
