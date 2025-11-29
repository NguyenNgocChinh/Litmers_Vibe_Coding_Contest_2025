# Database Seeder

Hệ thống seeder để tạo dữ liệu mẫu cho development và testing.

## Cách sử dụng

### 1. Chạy seeder qua npm script

```bash
# Chạy seeder (không xóa dữ liệu cũ, chỉ thêm mới)
npm run seed

# Xóa tất cả dữ liệu và seed lại từ đầu
npm run seed:clear
```

### 2. Chạy seeder qua HTTP endpoint (development only)

Khi server đang chạy, có thể gọi endpoint:

```bash
# Chạy seeder
curl -X POST http://localhost:3000/seed/run

# Xóa và seed lại
curl -X POST http://localhost:3000/seed/run?clear=true

# Chỉ xóa dữ liệu
curl -X POST http://localhost:3000/seed/clear
```

### 3. Chạy trực tiếp với ts-node

```bash
# Chạy seeder
npx ts-node -r tsconfig-paths/register src/seed/run-seed.ts

# Xóa và seed lại
npx ts-node -r tsconfig-paths/register src/seed/run-seed.ts --clear
```

## Dữ liệu được seed

Seeder sẽ tạo các dữ liệu mẫu sau:

### Users (6 users)
- John Doe (john.doe@example.com)
- Jane Smith (jane.smith@example.com)
- Bob Wilson (bob.wilson@example.com)
- Alice Johnson (alice.johnson@example.com)
- Charlie Brown (charlie.brown@example.com)
- Diana Prince (diana.prince@example.com)

### Teams (3 teams)
- **Development Team** (Owner: John Doe)
  - Members: John (OWNER), Jane (ADMIN), Bob (MEMBER), Alice (MEMBER)
- **Design Team** (Owner: Jane Smith)
  - Members: Jane (OWNER), Alice (ADMIN), Charlie (MEMBER)
- **Marketing Team** (Owner: Bob Wilson)
  - Members: Bob (OWNER), Diana (MEMBER)

### Projects (5 projects)
- Website Redesign (Development Team)
- Mobile App Development (Development Team)
- Brand Identity (Design Team)
- Social Media Campaign (Marketing Team)
- API Integration (Development Team)

### Mỗi project sẽ có:
- Project statuses: Backlog, In Progress, Done (và một số custom statuses)
- Labels: Bug, Feature, Enhancement, Documentation, Urgent

### Issues (8 issues)
- Issues với các trạng thái khác nhau (Backlog, In Progress, Done)
- Issues có priority (HIGH, MEDIUM, LOW)
- Issues có assignee, due dates, labels
- Issues có subtasks và comments

### Bổ sung:
- Project favorites
- Issue activities (change history)

## Lưu ý

1. **Seeder sẽ kiểm tra dữ liệu đã tồn tại**: Nếu user/team/project đã tồn tại (theo email/name), seeder sẽ bỏ qua và không tạo duplicate.

2. **Xóa dữ liệu**: Lệnh `--clear` sẽ xóa TẤT CẢ dữ liệu trong database. Hãy cẩn thận khi sử dụng!

3. **Dữ liệu test**: Đây là dữ liệu mẫu cho development. Không nên chạy trong môi trường production.

4. **Foreign key constraints**: Seeder tự động xử lý thứ tự insert để đảm bảo foreign key constraints được thỏa mãn.

## Cấu trúc code

- `seed.module.ts`: NestJS module cho seeder
- `seed.service.ts`: Service chứa logic seed các entities
- `seed.controller.ts`: Controller với HTTP endpoints (dev only)
- `run-seed.ts`: Standalone script để chạy seeder từ command line

## Customization

Để thay đổi dữ liệu seed, chỉnh sửa các method trong `seed.service.ts`:
- `seedUsers()`: Thay đổi danh sách users
- `seedTeams()`: Thay đổi teams và members
- `seedProjects()`: Thay đổi projects
- `seedIssues()`: Thay đổi issues
- Và các methods khác...

