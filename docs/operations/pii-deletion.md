# PII 폐기 절차 — 정산 후 데이터 삭제

작성일: 2026-05-15
관련 ADR: ADR-021 (학번+이름 필수) · F-I-006 (PII 자동 삭제)
대상: 본부 운영자 1명

## 0. 왜 수동 폐기인가

본 시스템은 **일회성 부스 운영** (2026-05-20, 5-21 양일).
F-I-006 명세는 "정산 후 N일 PII 자동 삭제 (cron 또는 startup task)"였으나,
인수인계 / Phase 2 가중치가 0이므로 cron 잡 대신 **운영자 수동 폐기 + 본 가이드**로 대체.
(Codex 리뷰 P1-5 — 2026-05-15)

## 1. 폐기 대상 PII

| 테이블 | 필드 | 비고 |
|---|---|---|
| `orders` | `student_id`, `name`, `external_token`, `access_token`, `depositor_name`, `other_name`, `bank`, `custom_bank` | 핵심 PII |
| `order_items` | `name` (스냅샷) | 메뉴명 — 정산 후 보존 가치 X |
| `used_coupons` | `student_id`, `name` | 학생 식별 |

## 2. 폐기 시점

- **D-day + 7일 (2026-05-28)**: 정산 검증 완료 + 회식 후 분쟁 가능성 종료.
- 권장 시점: 5/27 (수) 자정 이후, 학생회 미팅에서 결과 보고 직후.

## 3. 사전 보존 — ZIP 백업 우선

폐기 전 반드시:

```bash
# 1) 운영 컨테이너에서 마지막 ZIP 다운로드 (관리자 화면)
#    /admin/settlement → "📦 ZIP 다운로드" 클릭
# 2) ZIP은 학생회 클라우드 (구글 드라이브 학과 폴더)에 보존
#    파일명: settlement-2026-05-21.zip
# 3) ZIP에는 settlement.sql 덤프 + summary.json 포함 → 사후 통계 가능
```

ZIP에는 PII가 포함되므로 **암호화 폴더 또는 잠금 가능한 폴더에 보관**.

## 4. DB PII 삭제 명령

### 4.1 컨테이너 진입 후 SQLite 직접 조작

```bash
docker compose exec chickenedak sh
sqlite3 /data/order.sqlite

-- 학번/이름/이체 정보 null화 (행은 유지 — 정산 통계 보존)
UPDATE orders SET
  student_id    = NULL,
  name          = '(폐기)',
  external_token   = NULL,
  access_token  = NULL,
  depositor_name   = NULL,
  other_name    = NULL,
  bank          = NULL,
  custom_bank   = NULL;

-- 주문 항목 스냅샷 메뉴명은 정산 후 의미 없음 → 빈 문자열
UPDATE order_items SET name = '';

-- 쿠폰 사용 기록은 *학번 + 이름*이 핵심 PII → 전체 삭제
DELETE FROM used_coupons;

-- 변경 사항 영구 반영 + WAL 합치기
VACUUM;
.exit
```

### 4.2 컨테이너 종료 + named volume 백업

```bash
# 컨테이너 정지
docker compose down

# named volume `chickenedak-data` 백업 (압축 + 학생회 클라우드 업로드)
docker run --rm \
  -v chickenedak-data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/post-deletion-2026-05-28.tar.gz -C /data .

# 백업 후 운영 볼륨 삭제 (Phase 2 미진행 — 인수인계 X)
docker volume rm chickenedak-data
```

## 5. 검증 — 폐기 완료 확인

```bash
# 새 운영 환경에서 백업 ZIP만으로 통계 재구성 가능한지 확인
unzip settlement-2026-05-21.zip
cat summary.json
# {
#   "operating_date": "2026-05-21",
#   "total_orders": NN,
#   "total_amount": NNNNNN,
#   "generated_at": "..."
# }
```

## 6. 보존 의무 (학교 회계 요구 시)

학교 회계 감사 등 외부 요구가 있을 시:
- ZIP은 학생회 클라우드에 최소 1년 보존 (학과 명시 폴더).
- DB 직접 보존은 X — PII 노출 위험.
- 감사 요구 시 ZIP만 제출.

## 7. 책임자

- 폐기 실행: 본부 PIN 보유자 (학생회장 또는 위임자)
- 검증: 학생회 부회장
- 사후 보고: 학과 사무실 (필요 시)

---

**중요:** 본 절차를 실행하지 않으면 **GDPR/개인정보보호법 위반 소지**가 있다 (불필요한 PII 장기 보유). 정산 후 7일 내 반드시 수행.
