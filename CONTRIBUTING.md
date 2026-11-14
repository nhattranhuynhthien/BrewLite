# Quy ước làm việc nhóm

## Chiến lược branch
- `main`: luôn chạy được, chỉ merge qua pull request.
- Nhánh làm việc: `feature/<ten>`, `fix/<ten>`, `chore/<ten>`, `docs/<ten>`.
- Pull request cần CI xanh (lint, test, build) và ít nhất 1 người review mới được merge.

## Quy ước commit (Conventional Commits)
`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `test: ...`, `refactor: ...`

## Definition of Done
- Code chạy được, không lỗi build, đúng tiêu chí chấp nhận.
- Có commit rõ ràng và được review trong nhóm.
- API có validate đầu vào; UI xử lý loading/lỗi cơ bản.
- Có hướng dẫn chạy trong README.
- Thay đổi yêu cầu, sơ đồ, kiến trúc đi qua pull request và ghi rõ lý do.
