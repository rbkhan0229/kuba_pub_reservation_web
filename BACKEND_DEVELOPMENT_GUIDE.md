# KUBA Pub Reservation Backend Development Guide

## 1. 목적

이 문서는 KUBA 대동제 주점 예약 시스템의 백엔드 개발 기준을 정의한다.

현재 프론트엔드는 프로토타입으로 동작하지만, 실제 운영에서는 백엔드가 예약 가능 여부와 예약 데이터의 신뢰성을 최종 검증해야 한다.

백엔드의 핵심 책임은 다음과 같다.

- 예약 시간대별 남은 슬롯/수용 인원 검증
- 동일 이름 + 연락처 기준 중복 예약 방지
- ClubX 예약 인원이 실제 ClubX 예약자 리스트에 존재하는지 검증
- 예약 데이터 저장 및 예약조회 제공
- 개인정보 보관 기간 관리

## 2. 주요 도메인 개념

### 2.1 Non-ClubX Guest

비회원 또는 ClubX 혜택 없이 예약하는 인원이다.

필드:

```ts
type Guest = {
  name: string;
  phone: string; // normalized: 01012345678
};
```

### 2.2 ClubX Guest

ClubX 앱을 통해 예약한 것으로 입력되는 인원이다.

프론트에서는 `ClubX Username`만 입력받는다. 백엔드는 이 Username이 실제 ClubX 예약자 리스트에 존재하는지 확인해야 한다.

필드:

```ts
type ClubXGuest = {
  clubxUsername: string;
};
```

### 2.3 Reservation

```ts
type Reservation = {
  id: string;
  submittedAt: string;
  status: "confirmed" | "cancelled";
  guests: Guest[];
  clubxGuests: ClubXGuest[];
  selectedTimeSlots: string[]; // e.g. ["18:00", "18:30"]
  startTime: string; // e.g. "18:00"
  endTime: string; // e.g. "19:00"
  totalGuestCount: number;
  privacyConsent: boolean;
};
```

## 3. 시간 슬롯 정책

### 3.1 슬롯 정의

현재 프론트 기준 시간 슬롯은 30분 단위 구간이다.

예:

- `18:00`은 `18:00 - 18:30` 구간
- `18:30`은 `18:30 - 19:00` 구간
- 마지막 슬롯은 `01:00 - 01:30`

백엔드는 슬롯 시작 시각 배열을 단일 소스로 관리해야 한다.

```ts
const TIME_SLOTS = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
  "23:30",
  "00:00",
  "00:30",
  "01:00",
];
```

### 3.2 선택 가능 시간

현재 정책:

- 최소 이용 시간: 1시간
- 최대 이용 시간: 1시간 30분
- 선택 단위: 30분
- 선택 가능한 슬롯 개수: 2개 또는 3개
- 선택된 슬롯은 반드시 연속되어야 한다.

유효한 예:

```text
["18:00", "18:30"]
["18:00", "18:30", "19:00"]
```

유효하지 않은 예:

```text
["18:00"]
["18:00", "19:00"]
["18:00", "18:30", "19:00", "19:30"]
```

## 4. 남은 슬롯 검증

### 4.1 검증 목적

예약 신청 시 선택한 모든 시간 구간에 대해 수용 가능 인원이 남아 있어야 한다.

예를 들어 한 팀이 `18:00`, `18:30`, `19:00` 슬롯을 선택했다면, 세 슬롯 모두에 총 인원 수만큼 여유가 있어야 예약을 확정할 수 있다.

### 4.2 추천 데이터 모델

```ts
type TimeSlotCapacity = {
  slot: string; // "18:00"
  capacity: number; // 총 수용 가능 인원
  reservedCount: number; // 이미 예약된 인원
};
```

### 4.3 검증 방식

예약 요청이 들어오면:

1. `selectedTimeSlots`가 유효한 슬롯인지 확인한다.
2. 슬롯들이 연속인지 확인한다.
3. 슬롯 개수가 2개 또는 3개인지 확인한다.
4. `totalGuestCount`를 계산한다.
5. 선택된 모든 슬롯에 대해 `capacity - reservedCount >= totalGuestCount`인지 확인한다.
6. 모든 슬롯이 가능하면 트랜잭션 안에서 예약을 저장하고 각 슬롯의 `reservedCount`를 증가시킨다.

중요:

- 남은 슬롯 검증과 예약 저장은 반드시 하나의 트랜잭션으로 묶어야 한다.
- 동시에 여러 명이 같은 슬롯을 예약할 수 있으므로 race condition을 막아야 한다.
- DB row lock, transaction isolation, optimistic locking 중 하나를 사용해야 한다.

### 4.4 실패 응답 예시

```json
{
  "code": "TIME_SLOT_FULL",
  "message": "Selected time slot is no longer available.",
  "details": {
    "unavailableSlots": ["18:30"]
  }
}
```

## 5. 중복 예약 방지

### 5.1 기준

비회원 예약자는 이름 + 연락처 조합으로 중복 예약을 막는다.

동일한 사람이 여러 팀에 중복으로 들어가는 것도 막아야 하므로, 예약 대표자만이 아니라 `guests` 배열 전체를 대상으로 검사한다.

### 5.2 연락처 정규화

전화번호는 저장 전에 숫자만 남긴다.

예:

```text
010-1234-5678 -> 01012345678
01012345678 -> 01012345678
```

### 5.3 검증 방식

예약 요청의 모든 비회원 인원에 대해:

1. 이름을 trim한다.
2. 연락처를 normalize한다.
3. `status = confirmed`인 기존 예약의 `guests` 중 같은 이름 + 연락처가 있는지 확인한다.
4. 존재하면 예약을 거절한다.

### 5.4 DB 제약 추천

관계형 DB를 쓴다면 `reservation_guests` 테이블을 분리하고 아래처럼 유니크 제약을 둔다.

```sql
CREATE UNIQUE INDEX unique_confirmed_guest
ON reservation_guests (normalized_name, normalized_phone)
WHERE reservation_status = 'confirmed';
```

DB에 partial index를 지원하지 않는다면 애플리케이션 레벨 검증과 트랜잭션 lock을 함께 사용한다.

### 5.5 실패 응답 예시

```json
{
  "code": "DUPLICATE_GUEST",
  "message": "A guest with the same name and phone number already has a reservation.",
  "details": {
    "name": "김민수",
    "phone": "01012345678"
  }
}
```

## 6. ClubX 예약자 검증

### 6.1 목적

사용자가 ClubX 예약 인원으로 입력한 `ClubX Username`이 실제 ClubX에서 예약한 사람인지 확인해야 한다.

### 6.2 검증 대상

프론트에서 넘어오는 값:

```ts
clubxGuests: {
  clubxUsername: string;
}[];
```

### 6.3 ClubX 예약자 리스트 연동 방식

가능한 방식은 두 가지다.

#### Option A. ClubX API 연동

ClubX 서버에 예약자 검증 API를 만든다.

예:

```http
GET /clubx/reservations/verify?username={clubxUsername}
```

응답:

```json
{
  "exists": true,
  "username": "clubx_user",
  "reservationStatus": "confirmed"
}
```

#### Option B. ClubX 예약자 CSV/관리자 업로드

행사 운영 전에 ClubX 예약자 리스트를 CSV로 업로드하고, 백엔드 DB에 저장한다.

추천 테이블:

```ts
type ClubXReservationMember = {
  clubxUsername: string;
  status: "confirmed" | "cancelled";
  importedAt: string;
};
```

### 6.4 검증 규칙

예약 요청의 모든 ClubX Username에 대해:

1. 공백 제거
2. 대소문자 정책 통일
   - 추천: 비교는 lowercase 기준
   - 표시는 사용자가 입력한 원문 유지 가능
3. ClubX 예약자 리스트에서 존재 여부 확인
4. `status = confirmed`인지 확인
5. 이미 다른 KUBA 예약에 사용된 ClubX Username인지 확인

### 6.5 ClubX Username 중복 방지

같은 ClubX Username이 여러 예약에 중복 포함되면 안 된다.

추천 제약:

```sql
CREATE UNIQUE INDEX unique_confirmed_clubx_username
ON reservation_clubx_guests (normalized_clubx_username)
WHERE reservation_status = 'confirmed';
```

### 6.6 실패 응답 예시

ClubX 예약자 리스트에 없는 경우:

```json
{
  "code": "CLUBX_USER_NOT_FOUND",
  "message": "ClubX Username was not found in the ClubX reservation list.",
  "details": {
    "clubxUsername": "unknown_user"
  }
}
```

이미 다른 예약에 포함된 경우:

```json
{
  "code": "DUPLICATE_CLUBX_USER",
  "message": "This ClubX Username is already included in another reservation.",
  "details": {
    "clubxUsername": "clubx_user"
  }
}
```

## 7. 예약 생성 API

### 7.1 Endpoint

```http
POST /api/reservations
```

### 7.2 Request

```json
{
  "guests": [
    {
      "name": "김민수",
      "phone": "010-1234-5678"
    }
  ],
  "clubxGuests": [
    {
      "clubxUsername": "clubx_user"
    }
  ],
  "selectedTimeSlots": ["18:00", "18:30"],
  "privacyConsent": true
}
```

### 7.3 Server-side validation order

추천 순서:

1. 개인정보 동의 여부 확인
2. 비회원/ClubX 인원 합산 1명 이상인지 확인
3. 이름/연락처/Username 형식 검증
4. 시간 슬롯 형식, 개수, 연속성 검증
5. 이름 + 연락처 중복 예약 확인
6. ClubX Username이 ClubX 예약자 리스트에 있는지 확인
7. ClubX Username 중복 사용 확인
8. 선택 슬롯의 잔여 수용 인원 확인
9. 트랜잭션으로 예약 저장 및 슬롯 카운트 갱신

### 7.4 Success Response

```json
{
  "id": "KUBA-2026-0001",
  "submittedAt": "2026-05-17T12:00:00+09:00",
  "guests": [
    {
      "name": "김민수",
      "phone": "010-1234-5678"
    }
  ],
  "clubxGuests": [
    {
      "clubxUsername": "clubx_user"
    }
  ],
  "selectedTimeSlots": ["18:00", "18:30"],
  "startTime": "18:00",
  "endTime": "19:00",
  "totalGuestCount": 2,
  "privacyConsent": true
}
```

## 8. 예약 조회 API

### 8.1 비회원 조회

```http
GET /api/reservations/lookup?name={name}&phone={phone}
```

비회원은 이름 + 연락처로 조회한다.

### 8.2 ClubX 조회

```http
GET /api/reservations/lookup?clubxUsername={clubxUsername}
```

ClubX 예약 인원은 ClubX Username으로 조회한다.

### 8.3 조회 규칙

- `clubxUsername`이 있으면 ClubX Username 기준으로 조회한다.
- `clubxUsername`이 없으면 `name + phone` 기준으로 조회한다.
- 취소된 예약은 기본 조회 결과에서 제외한다.
- 연락처는 normalize해서 비교한다.
- ClubX Username은 lowercase normalize해서 비교한다.

### 8.4 Not Found Response

```json
{
  "code": "RESERVATION_NOT_FOUND",
  "message": "No matching reservation was found."
}
```

## 9. 추천 DB 테이블 구조

### 9.1 reservations

```sql
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  submitted_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_guest_count INTEGER NOT NULL,
  privacy_consent BOOLEAN NOT NULL
);
```

### 9.2 reservation_guests

```sql
CREATE TABLE reservation_guests (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
```

### 9.3 reservation_clubx_guests

```sql
CREATE TABLE reservation_clubx_guests (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  clubx_username TEXT NOT NULL,
  normalized_clubx_username TEXT NOT NULL,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
```

### 9.4 reservation_time_slots

```sql
CREATE TABLE reservation_time_slots (
  reservation_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  PRIMARY KEY (reservation_id, slot),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
```

### 9.5 time_slot_capacities

```sql
CREATE TABLE time_slot_capacities (
  slot TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL,
  reserved_count INTEGER NOT NULL DEFAULT 0
);
```

### 9.6 clubx_reservation_members

```sql
CREATE TABLE clubx_reservation_members (
  normalized_clubx_username TEXT PRIMARY KEY,
  clubx_username TEXT NOT NULL,
  status TEXT NOT NULL,
  imported_at TIMESTAMP NOT NULL
);
```

## 10. 트랜잭션 처리 예시

예약 생성은 아래 작업을 하나의 트랜잭션으로 처리한다.

```text
BEGIN
  1. selectedTimeSlots row lock
  2. duplicate guest check
  3. duplicate ClubX username check
  4. ClubX reservation list check
  5. slot capacity check
  6. insert reservation
  7. insert guests
  8. insert ClubX guests
  9. insert reservation_time_slots
  10. update time_slot_capacities.reserved_count
COMMIT
```

실패하면 전체 rollback한다.

## 11. 프론트엔드 연동 시 변경점

현재 프론트는 localStorage에 저장한다.

백엔드 연동 시 다음을 바꾼다.

### 11.1 예약 생성

현재:

```js
saveReservation(finalReservation);
```

변경:

```js
await fetch("/api/reservations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

### 11.2 예약조회

현재:

```js
getSavedReservations().find(...)
```

변경:

```js
await fetch(`/api/reservations/lookup?name=${name}&phone=${phone}`);
await fetch(`/api/reservations/lookup?clubxUsername=${clubxUsername}`);
```

### 11.3 에러 표시

백엔드는 `code`를 내려주고, 프론트는 code별 사용자 메시지를 보여준다.

추천 code:

```text
INVALID_INPUT
PRIVACY_CONSENT_REQUIRED
INVALID_TIME_SLOT
TIME_SLOT_FULL
DUPLICATE_GUEST
DUPLICATE_CLUBX_USER
CLUBX_USER_NOT_FOUND
RESERVATION_NOT_FOUND
```

## 12. 운영 체크리스트

- 행사 전 시간대별 `capacity` 설정
- ClubX 예약자 리스트 최신화
- 중복 예약 테스트
- 동시 예약 테스트
- 예약조회 테스트
- 개인정보 삭제 일정 설정
- 관리자용 예약 목록 export 기능 준비
- 현장 운영자가 볼 수 있는 시간대별 예약 현황 페이지 준비

