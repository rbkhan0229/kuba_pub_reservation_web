const LAST_SUBMITTED_KEY = "kuba_last_submitted_reservation_code";

const RUNTIME_CONFIG =
  (typeof window !== "undefined" && window.KUBA_PUB_CONFIG) || {};
const API_BASE = (RUNTIME_CONFIG.API_BASE || "").replace(/\/$/, "");

async function apiRequest(path, { method = "GET", body } = {}) {
  if (!API_BASE) {
    throw new Error(
      "API_BASE is not configured. Edit config.js to point to your backend.",
    );
  }
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      appState && appState.lang === "en"
        ? "Network error. Please try again."
        : "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
    );
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    const err = new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function apiGet(path) {
  return apiRequest(path);
}

function apiPost(path, body) {
  return apiRequest(path, { method: "POST", body });
}

function normalizePath(path) {
  if (!path) return "/";

  let normalized = String(path).trim().split("?")[0].split("#")[0] || "/";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/index\.html$/, "/").replace(/\/+/g, "/");

  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}

const appState = {
  lang: localStorage.getItem("kuba_lang") || "ko",
  route: normalizePath(window.location.pathname),
  reservation: null,
  lookupResult: null,
  lookupMessage: "",
  modalOpen: false,
  androidNotice: "",
  submitted: null,
  // Backend-driven configuration / state
  configLoaded: false,
  configError: "",
  eventId: null,
  serviceDate: null,
  slotIntervalMinutes: 30,
  minBookingMinutes: 60,
  maxBookingMinutes: 90,
  availability: null,
  availabilityLoading: false,
  availabilityError: "",
  availabilityPartySize: 0,
  submitting: false,
  submitError: "",
  lookupLoading: false,
};

// Time-block runtime state, populated from backend availability.
let timeSlots = [
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
  "00:00", "00:30", "01:00",
];
let blockMap = {}; // label -> { id, start_minute, end_minute, status, remaining_tables }

const emptyGuest = () => ({ id: crypto.randomUUID(), name: "", phone: "" });
const emptyClubXGuest = () => ({
  id: crypto.randomUUID(),
  query: "",
  results: [],
  searching: false,
  searchError: "",
  selectedUser: null,
  searchToken: 0,
});

const t = {
  ko: {
    brand: "KUBA 대동제 주점",
    brandSub: "예약 웹사이트",
    home: "Home",
    faq: "FAQ",
    lookup: "예약조회",
    checkReservation: "예약 조회하기",
    posterKicker: "Festival Pub Benefit",
    posterTitle: "ClubX<br>예약 혜택 이벤트",
    posterBody: [
      "KUBA 대동제 주점에서는 현장 주류 판매가 불가능하여, 기본적으로 손님이 직접 주류를 구매해 오셔야 합니다.",
      "하지만 ClubX 앱을 통해 예약한 손님에게는 소주 또는 맥주를 무료로 증정합니다.",
      "테이블 전원이 ClubX를 통해 예약한 팀에게는 술을 시원하게 보관할 수 있는 아이스 버켓도 함께 제공합니다.",
    ],
    notice:
      "주의사항: 현장 상황에 따라 소주 또는 맥주 중 일부 품목이 먼저 품절될 수 있습니다.",
    startTitle: "예약 방법 선택",
    startCopy:
      "혜택 없이 빠르게 예약하거나, ClubX 앱으로 예약하고 이벤트 혜택을 받을 수 있습니다.",
    guestCta: "혜택 받지 않고 비회원 예약",
    clubxCta: "ClubX로 예약하고 혜택 받기",
    clubxTitle: "ClubX 앱으로 예약하기",
    clubxDesc: "사용 중인 기기를 선택하면 앱 다운로드 페이지로 이동합니다.",
    ios: "iOS - CLUB X: Open Square",
    android: "Android",
    androidNotice: "Android 버전은 현재 준비 중입니다.",
    backHome: "메인으로 돌아가기",
    guestTitle: "비회원 예약",
    guestGuide:
      "ClubX 혜택 없이 예약하거나, 일부 일행만 ClubX로 예약한 혼합 그룹을 위한 신청 페이지입니다.",
    nonClubxSection: "비회원 인원",
    addGuest: "비회원 인원 추가",
    clubxQuestion: "ClubX를 통해 예약한 인원이 있나요?",
    clubxSection: "ClubX 예약 인원",
    addClubx: "ClubX 예약 인원 추가",
    name: "이름",
    phone: "연락처",
    username: "ClubX Username",
    delete: "삭제",
    total: (n) => `총 인원: ${n}명`,
    timeTitle: "주점 이용시간 선택",
    timeHelp: "30분 단위로 연속된 1시간부터 1시간 30분까지 선택할 수 있습니다.",
    selectedTime: "선택 시간",
    noTime: "선택된 시간이 없습니다.",
    privacyView: "개인정보 활용 동의 약관보기",
    privacyAgree: "예약 확인 및 운영을 위한 개인정보 활용에 동의합니다.",
    submit: "신청하기",
    confirmTitle: "최종 신청 내용을 확인해주세요",
    cancel: "취소",
    confirm: "최종 신청",
    complete: "예약 신청이 완료되었습니다.",
    completeGuide:
      "아래 예약 정보를 확인해주세요. 같은 정보는 예약조회 페이지에서도 다시 확인할 수 있습니다.",
    newReservation: "새 예약 신청하기",
    reservationId: "예약 ID",
    submittedAt: "신청 완료 시간",
    nonClubxGuests: "비회원 인원 정보",
    clubxGuests: "ClubX 예약 인원 정보",
    noGuests: "입력된 인원이 없습니다.",
    validation: {
      name: "이름에는 숫자나 특수문자를 사용할 수 없습니다.",
      phone: "올바른 연락처 형식을 입력해주세요. 예: 010-1234-5678",
      username: "ClubX Username을 입력해주세요.",
      oneGuest: "최소 1명 이상 입력해주세요.",
      timeShort: "이용시간은 최소 1시간 이상 선택해야 합니다.",
      timeLong: "이용시간은 최대 1시간 30분까지 선택할 수 있습니다.",
      privacy: "개인정보 활용 동의가 필요합니다.",
    },
    lookupTitle: "예약조회",
    lookupDesc:
      "비회원은 이름과 연락처로, ClubX 예약 인원은 ClubX Username으로 예약 내용을 확인할 수 있습니다.",
    lookupGuestGroup: "비회원 예약 조회",
    lookupClubxGroup: "ClubX 예약 조회",
    lookupOr: "또는",
    lookupUsername: "ClubX Username으로 조회",
    lookupFail: "일치하는 예약 정보를 찾을 수 없습니다.",
    privacyTitle: "개인정보 활용 동의",
    backReservation: "예약 페이지로 돌아가기",
    terms: `개인정보 활용 동의

KUBA 대동제 주점 예약 운영을 위해 아래와 같이 개인정보를 수집 및 이용합니다.

1. 수집 항목
- 이름
- 연락처
- ClubX Username: ClubX 예약 인원이 있는 경우에만 수집

2. 수집 및 이용 목적
- 예약자 본인 확인
- 예약 내용 확인 및 예약 조회
- 주점 이용 시간 및 인원 확인
- 현장 운영 중 필요한 안내 또는 연락

3. 보관 기간
수집된 개인정보는 대동제 주점 운영 및 예약 확인이 종료된 후 지체 없이 삭제하는 것을 원칙으로 합니다. 단, 운영상 확인이 필요한 경우 행사 종료 후 최대 7일간 보관할 수 있습니다.

4. 동의 거부 권리
개인정보 제공에 동의하지 않을 수 있습니다. 다만, 동의하지 않을 경우 예약 신청 및 예약 조회 서비스 이용이 제한될 수 있습니다.

5. 안내
수집된 개인정보는 KUBA 대동제 주점 예약 운영 목적 외에는 사용하지 않습니다.`,
    faqTitle: "FAQ",
    faqQ: "Q. 일행 중 일부만 ClubX를 통해 예약하고 싶으면 어떻게 하나요?",
    faqA: "A. ClubX 사용자들끼리만 친구 태그를 통해 예약한 후, 비회원 예약 페이지에서 `ClubX를 통해 예약한 일행이 있나요?`에 예를 체크하고 ClubX Username을 기재해주시면 됩니다.",
    clubxSearchPlaceholder: "이름 또는 ClubX Username을 입력하세요 (2자 이상)",
    clubxSearchHint: "최소 2자 이상 입력 후 후보에서 선택해주세요.",
    clubxSearchEmpty: "일치하는 사용자가 없습니다.",
    clubxSearchError: "검색 중 오류가 발생했습니다.",
    clubxSelected: "선택됨",
    clubxChange: "변경",
    selectedRequired: "목록에서 ClubX 사용자를 선택해주세요.",
    availabilityLoading: "예약 가능 시간을 불러오는 중...",
    availabilityError: "예약 가능 시간을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    soldOut: "선택한 시간대가 마감되었습니다. 다른 시간을 선택해주세요.",
    submitting: "예약 신청 중...",
    submitError: "예약 신청에 실패했습니다.",
    completeRefreshHint:
      "예약 정보가 사라졌다면 예약조회 페이지에서 이름/연락처 또는 예약번호로 다시 조회해주세요.",
    configError: "예약 서비스 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
  },
  en: {
    brand: "KUBA Festival Pub",
    brandSub: "Reservation Website",
    home: "Home",
    faq: "FAQ",
    lookup: "Check Reservation",
    checkReservation: "Check Reservation",
    posterKicker: "Festival Pub Benefit",
    posterTitle: "ClubX Reservation Benefit Event",
    posterBody: [
      "At the KUBA Festival Pub, alcoholic beverages cannot be sold on-site, so guests are normally required to bring their own drinks.",
      "However, guests who reserve through the ClubX app will receive free soju or beer.",
      "If every person at the table reserves through ClubX, the team will also receive an ice bucket to keep drinks cold.",
    ],
    notice:
      "Notice: Depending on on-site availability, either soju or beer may run out first.",
    startTitle: "Choose Your Reservation Path",
    startCopy:
      "Make a quick guest reservation without benefits, or reserve through ClubX to receive event benefits.",
    guestCta: "Guest Reservation Without Benefits",
    clubxCta: "Reserve with ClubX & Get Benefits",
    clubxTitle: "Reserve through the ClubX App",
    clubxDesc: "Select your device to go to the app download page.",
    ios: "iOS - CLUB X: Open Square",
    android: "Android",
    androidNotice: "The Android version is currently in development.",
    backHome: "Back to Home",
    guestTitle: "Guest Reservation",
    guestGuide:
      "This page is for Non-ClubX guests and mixed groups where only some guests reserved through ClubX.",
    nonClubxSection: "Non-ClubX Guests",
    addGuest: "Add Non-ClubX Guest",
    clubxQuestion: "Are there guests who reserved through ClubX?",
    clubxSection: "ClubX Guests",
    addClubx: "Add ClubX Guest",
    name: "Name",
    phone: "Phone Number",
    username: "ClubX Username",
    delete: "Delete",
    total: (n) => `Total Guests: ${n}`,
    timeTitle: "Select Pub Time",
    timeHelp:
      "Select continuous 30-minute blocks from 1 hour up to 1 hour 30 minutes.",
    selectedTime: "Selected Time",
    noTime: "No time selected.",
    privacyView: "View Privacy Consent Terms",
    privacyAgree:
      "I agree to the use of my personal information for reservation confirmation and event operation.",
    submit: "Submit Reservation",
    confirmTitle: "Please Confirm Your Reservation",
    cancel: "Cancel",
    confirm: "Confirm Reservation",
    complete: "Your reservation has been submitted.",
    completeGuide:
      "Please review your reservation details below. You can also find them later on the reservation lookup page.",
    newReservation: "Submit Another Reservation",
    reservationId: "Reservation ID",
    submittedAt: "Submitted At",
    nonClubxGuests: "Non-ClubX Guest Information",
    clubxGuests: "ClubX Guest Information",
    noGuests: "No guests entered.",
    validation: {
      name: "Name cannot contain numbers or special characters.",
      phone: "Please enter a valid phone number. Example: 010-1234-5678",
      username: "Please enter a ClubX Username.",
      oneGuest: "Please enter at least one guest.",
      timeShort: "Please select at least 1 hour.",
      timeLong: "Please select up to 1 hour 30 minutes.",
      privacy: "Privacy consent is required.",
    },
    lookupTitle: "Check Reservation",
    lookupDesc:
      "Non-ClubX guests can search by name and phone number. ClubX guests can search by ClubX Username.",
    lookupGuestGroup: "Guest Reservation Lookup",
    lookupClubxGroup: "ClubX Reservation Lookup",
    lookupOr: "OR",
    lookupUsername: "Search by ClubX Username",
    lookupFail: "No matching reservation was found.",
    privacyTitle: "Privacy Consent",
    backReservation: "Back to Reservation",
    terms: `Privacy Consent

For the operation of the KUBA Festival Pub reservation system, we collect and use personal information as described below.

1. Information Collected
- Name
- Phone number
- ClubX Username: collected only if there are guests who reserved through ClubX

2. Purpose of Collection and Use
- To verify the reservation holder
- To confirm reservation details and support reservation lookup
- To check the reserved time and number of guests
- To contact guests if needed for on-site event operation

3. Retention Period
Personal information will be deleted without delay after the festival pub operation and reservation confirmation process ends. If additional operational confirmation is needed, the information may be retained for up to 7 days after the event ends.

4. Right to Refuse Consent
You may refuse to provide consent. However, if you do not consent, reservation submission and reservation lookup may be limited.

5. Notice
Collected personal information will not be used for purposes other than operating the KUBA Festival Pub reservation system.`,
    faqTitle: "FAQ",
    faqQ: "Q. What should I do if only some members of my group want to reserve through ClubX?",
    faqA: "A. ClubX users can reserve together by tagging each other as friends in the app. Then, on the guest reservation page, check `Are there guests who reserved through ClubX?` and enter their ClubX Username.",
    clubxSearchPlaceholder: "Type a legal name or ClubX username (min 2 chars)",
    clubxSearchHint: "Type at least 2 characters and pick a user from the list.",
    clubxSearchEmpty: "No matching users found.",
    clubxSearchError: "Search failed.",
    clubxSelected: "Selected",
    clubxChange: "Change",
    selectedRequired: "Please select a ClubX user from the list.",
    availabilityLoading: "Loading available time slots...",
    availabilityError: "Failed to load availability. Please try again.",
    soldOut:
      "The selected time was just sold out. Please pick another time.",
    submitting: "Submitting reservation...",
    submitError: "Reservation submission failed.",
    completeRefreshHint:
      "If you don't see your reservation details, look them up on the lookup page using your name and phone or reservation code.",
    configError: "Failed to load reservation service settings. Please try again.",
  },
};

const FALLBACK_TIME_SLOTS = [
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
  "00:00", "00:30", "01:00",
];

function initReservation() {
  appState.reservation = {
    guests: [emptyGuest()],
    hasClubXGuests: false,
    clubxGuests: [],
    selectedTimeSlots: [],
    privacyConsent: false,
    errors: {},
  };
}

function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function messages() {
  return t[appState.lang];
}

function navigate(path) {
  const normalizedPath = normalizePath(path);
  if (normalizedPath !== appState.route) {
    history.pushState({}, "", normalizedPath);
  }
  appState.route = normalizedPath;
  if (normalizedPath === "/guest-reservation" && !appState.reservation) initReservation();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function setLang(lang) {
  appState.lang = lang;
  localStorage.setItem("kuba_lang", lang);
  document.documentElement.lang = lang;
  render();
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizePhone(value) {
  return value.replace(/\D/g, "");
}

function validateName(name) {
  return /^[A-Za-z가-힣\s]{1,}$/.test(name.trim());
}

function validatePhone(phone) {
  return /^010-\d{4}-\d{4}$/.test(formatPhone(phone));
}

function validateUsername(username) {
  return username.trim().length >= 2;
}

function hasGuestInput(guest) {
  return Boolean(guest.name.trim() || guest.phone.trim());
}

function isGuestComplete(guest) {
  return validateName(guest.name) && validatePhone(guest.phone);
}

function hasClubXGuestInput(guest) {
  return Boolean(
    (guest.query && guest.query.trim()) ||
      guest.selectedUser ||
      (guest.clubxUsername && guest.clubxUsername.trim()),
  );
}

function isClubXGuestComplete(guest) {
  return Boolean(guest.selectedUser && guest.selectedUser.user_id);
}

function completedGuests(reservation) {
  return reservation.guests.filter(isGuestComplete);
}

function completedClubXGuests(reservation) {
  return reservation.clubxGuests.filter(isClubXGuestComplete);
}

function completedGuestCount(reservation) {
  return (
    completedGuests(reservation).length +
    completedClubXGuests(reservation).length
  );
}

function updateTotalCountDom() {
  const totalCount = document.querySelector("[data-total-count]");
  if (!totalCount || !appState.reservation) return;
  totalCount.textContent = messages().total(
    completedGuestCount(appState.reservation),
  );
}

function getSlotInterval() {
  return appState.slotIntervalMinutes || 30;
}

function getMinSlotCount() {
  const interval = getSlotInterval();
  return Math.max(1, Math.ceil((appState.minBookingMinutes || 60) / interval));
}

function getMaxSlotCount() {
  const interval = getSlotInterval();
  return Math.max(
    getMinSlotCount(),
    Math.floor((appState.maxBookingMinutes || 90) / interval),
  );
}

function isSlotUnavailable(label) {
  const block = blockMap[label];
  if (!block) return false;
  return block.status === "sold_out";
}

function getSavedReservations() {
  // Legacy localStorage cache is no longer authoritative. Returned only for
  // backwards compatibility with any code path still calling it.
  try {
    return JSON.parse(localStorage.getItem("kuba_pub_reservations") || "[]");
  } catch {
    return [];
  }
}

function timeRange(slots) {
  if (!slots.length) return messages().noTime;
  const indexes = slots
    .map((slot) => timeSlots.indexOf(slot))
    .sort((a, b) => a - b);
  const start = timeSlots[indexes[0]];
  const last = timeSlots[indexes[indexes.length - 1]];
  const end = slotEndTime(last);
  return `${start} - ${end}`;
}

function slotEndTime(slot) {
  const block = blockMap[slot];
  if (block && typeof block.end_minute === "number") {
    return minuteToLabel(block.end_minute);
  }
  const [hour, minute] = slot.split(":").map(Number);
  const interval = getSlotInterval();
  const endDate = new Date(2026, 4, 11, hour, minute + interval);
  return `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
}

function minuteToLabel(totalMinutes) {
  const m = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function validateReservation() {
  const m = messages();
  const r = appState.reservation;
  const errors = {};

  r.guests.filter(hasGuestInput).forEach((guest) => {
    if (!validateName(guest.name))
      errors[`name-${guest.id}`] = m.validation.name;
    if (!validatePhone(guest.phone))
      errors[`phone-${guest.id}`] = m.validation.phone;
  });

  r.clubxGuests.forEach((guest) => {
    if (!isClubXGuestComplete(guest)) {
      errors[`username-${guest.id}`] = m.selectedRequired;
    }
  });

  const total = completedGuestCount(r);
  if (total < 1) errors.general = m.validation.oneGuest;
  const minSlots = getMinSlotCount();
  const maxSlots = getMaxSlotCount();
  if (r.selectedTimeSlots.length < minSlots) errors.time = m.validation.timeShort;
  if (r.selectedTimeSlots.length > maxSlots) errors.time = m.validation.timeLong;
  if (!r.privacyConsent) errors.privacy = m.validation.privacy;

  r.errors = errors;
  return Object.keys(errors).length === 0;
}

function createFinalReservation() {
  const r = appState.reservation;
  const guests = completedGuests(r);
  const clubxGuests = completedClubXGuests(r);
  return {
    submittedAt: new Date().toLocaleString(
      appState.lang === "ko" ? "ko-KR" : "en-US",
    ),
    guests: copy(guests),
    hasClubXGuests: r.hasClubXGuests,
    clubxGuests: clubxGuests.map((g) => ({
      id: g.id,
      clubxUsername: g.selectedUser ? g.selectedUser.username : "",
      displayName: g.selectedUser ? g.selectedUser.display_name : "",
    })),
    selectedTimeSlots: [...r.selectedTimeSlots],
    totalGuestCount: guests.length + clubxGuests.length,
    privacyConsent: r.privacyConsent,
  };
}

function buildReservationPayload() {
  const r = appState.reservation;
  const guests = completedGuests(r);
  const clubxGuests = completedClubXGuests(r);
  const sortedSlots = [...r.selectedTimeSlots].sort(
    (a, b) => timeSlots.indexOf(a) - timeSlots.indexOf(b),
  );
  const first = blockMap[sortedSlots[0]];
  const last = blockMap[sortedSlots[sortedSlots.length - 1]];
  if (!first || !last) {
    throw new Error(messages().soldOut);
  }
  return {
    event_id: appState.eventId,
    start_minute: first.start_minute,
    end_minute: last.end_minute,
    non_clubx_guests: guests.map((g) => ({
      name: g.name.trim(),
      phone: normalizePhone(g.phone),
    })),
    clubx_guests: clubxGuests.map((g) => ({
      user_id: g.selectedUser.user_id,
    })),
    privacy_consent: true,
    locale: appState.lang,
  };
}

function summaryHtml(reservation) {
  const m = messages();
  const guestRows = reservation.guests && reservation.guests.length
    ? reservation.guests
        .map(
          (g) =>
            `<li>${escapeHtml(g.name || "")}${g.phone ? ` · ${escapeHtml(formatPhone(g.phone))}` : ""}</li>`,
        )
        .join("")
    : `<li>${m.noGuests}</li>`;
  const clubxRows = reservation.clubxGuests && reservation.clubxGuests.length
    ? reservation.clubxGuests
        .map((g) => {
          const display = g.displayName || g.display_name || "";
          const username = g.clubxUsername || g.username || "";
          const label = display && username
            ? `${escapeHtml(display)} (@${escapeHtml(username)})`
            : escapeHtml(display || username);
          return `<li>${label}</li>`;
        })
        .join("")
    : `<li>${m.noGuests}</li>`;

  const code = reservation.reservation_code || reservation.id;
  const submittedAt = reservation.submittedAt || reservation.submitted_at_display;
  const slots = reservation.selectedTimeSlots || [];
  const timeText = reservation.time_range_display || timeRange(slots);
  const totalCount =
    reservation.totalGuestCount ||
    reservation.total_party_size ||
    ((reservation.guests || []).length + (reservation.clubxGuests || []).length);

  return `
    <div class="summary">
      ${code ? `<div class="summary-block"><h3>${m.reservationId}</h3><p class="muted">${escapeHtml(code)}</p></div>` : ""}
      ${submittedAt ? `<div class="summary-block"><h3>${m.submittedAt}</h3><p class="muted">${escapeHtml(submittedAt)}</p></div>` : ""}
      <div class="summary-block"><h3>${m.selectedTime}</h3><p class="muted">${escapeHtml(timeText)}</p></div>
      <div class="summary-block"><h3>${m.nonClubxGuests}</h3><ul class="summary-list">${guestRows}</ul></div>
      <div class="summary-block"><h3>${m.clubxGuests}</h3><ul class="summary-list">${clubxRows}</ul></div>
      <div class="total-pill">${m.total(totalCount)}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function layout(content) {
  const m = messages();
  return `
    <div class="app-shell">
      <header class="topbar">
        <a href="/" class="brand" data-link>
          <span class="brand-mark">K</span>
          <span><span class="brand-title">${m.brand}</span><br><span class="brand-subtitle">${m.brandSub}</span></span>
        </a>
        <div class="top-actions">
          <nav class="nav-links" aria-label="Main navigation">
            <a class="nav-link" href="/" data-link>${m.home}</a>
            <a class="nav-link" href="/faq" data-link>${m.faq}</a>
            <a class="nav-link" href="/reservation-lookup" data-link>${m.lookup}</a>
          </nav>
          <div class="language-toggle" aria-label="Language selection">
            <button class="lang-button ${appState.lang === "ko" ? "active" : ""}" data-lang="ko">한국어</button>
            <button class="lang-button ${appState.lang === "en" ? "active" : ""}" data-lang="en">English</button>
          </div>
        </div>
      </header>
      <main class="page">${content}</main>
    </div>
  `;
}

function homePage() {
  const m = messages();
  return layout(`
    <section class="hero">
      <article class="poster">
        <span class="poster-kicker">${m.posterKicker}</span>
        <h1>${m.posterTitle}</h1>
        <div class="poster-copy">
          ${m.posterBody.map((p) => `<p>${p}</p>`).join("")}
          <p class="notice">${m.notice}</p>
        </div>
      </article>
      <aside class="side-panel">
        <div>
          <span class="section-label">Reservation</span>
          <h2>${m.startTitle}</h2>
          <p class="muted">${m.startCopy}</p>
        </div>
        <div>
          <div class="cta-grid">
            <a class="button dark" href="/guest-reservation" data-link>${m.guestCta}</a>
            <a class="button primary" href="/clubx" data-link>${m.clubxCta}</a>
          </div>
        </div>
      </aside>
    </section>
  `);
}

function clubxPage() {
  const m = messages();
  return layout(`
    <div class="content-grid">
      <section class="panel emphasis">
        <span class="section-label">ClubX</span>
        <h1 class="page-title">${m.clubxTitle}</h1>
        <p class="muted">${m.clubxDesc}</p>
        <div class="form-actions" style="justify-content:flex-start">
          <a class="button primary" href="https://apps.apple.com/kr/app/club-x-open-square/id6761349162?l=en-GB" target="_blank" rel="noreferrer">${m.ios}</a>
          <button class="button" data-android>${m.android}</button>
          <a class="button small" href="/" data-link>${m.backHome}</a>
        </div>
      </section>
      ${appState.androidNotice ? `<div class="toast">${appState.androidNotice}</div>` : ""}
    </div>
  `);
}

function guestReservationPage() {
  if (!appState.reservation) initReservation();
  const m = messages();
  const r = appState.reservation;
  const totalGuestCount = completedGuestCount(r);
  const finalDraft = {
    guests: completedGuests(r),
    clubxGuests: completedClubXGuests(r),
    selectedTimeSlots: r.selectedTimeSlots,
    totalGuestCount,
  };

  return layout(`
    <div class="page-header">
      <div>
        <span class="section-label">Reservation</span>
        <h1 class="page-title">${m.guestTitle}</h1>
        <p class="muted">${m.guestGuide}</p>
      </div>
      <div class="total-pill" data-total-count>${m.total(totalGuestCount)}</div>
    </div>
    <div class="content-grid">
      <section class="panel">
        <div class="section-head">
          <h2>${m.nonClubxSection}</h2>
          <button class="button small dark" data-add-guest>${m.addGuest}</button>
        </div>
        <div class="guest-list">
          ${r.guests.length ? r.guests.map((guest) => guestCard(guest, false)).join("") : `<div class="empty-state">${m.noGuests}</div>`}
        </div>
        ${r.errors.general ? `<p class="error">${r.errors.general}</p>` : ""}
      </section>

      <section class="panel">
        <label class="checkbox-row">
          <input type="checkbox" data-has-clubx ${r.hasClubXGuests ? "checked" : ""}>
          <span>${m.clubxQuestion}</span>
        </label>
        ${
          r.hasClubXGuests
            ? `
          <div class="section-head" style="margin-top:18px">
            <h2>${m.clubxSection}</h2>
            <button class="button small primary" data-add-clubx>${m.addClubx}</button>
          </div>
          <div class="guest-list">
            ${r.clubxGuests.length ? r.clubxGuests.map((guest) => guestCard(guest, true)).join("") : `<div class="empty-state">${m.noGuests}</div>`}
          </div>
        `
            : ""
        }
      </section>

      <section class="panel">
        <h2>${m.timeTitle}</h2>
        <p class="muted">${m.timeHelp}</p>
        ${timeSlotGrid()}
        <p class="muted"><strong>${m.selectedTime}:</strong> ${timeRange(r.selectedTimeSlots)}</p>
        ${r.errors.time ? `<p class="error">${r.errors.time}</p>` : ""}
      </section>

      <section class="panel">
        <div class="form-actions" style="justify-content:flex-start;margin-top:0">
          <a class="button small" href="/privacy-terms" data-link>${m.privacyView}</a>
        </div>
        <label class="checkbox-row" style="margin-top:16px">
          <input type="checkbox" data-privacy ${r.privacyConsent ? "checked" : ""}>
          <span>${m.privacyAgree}</span>
        </label>
        ${r.errors.privacy ? `<p class="error">${r.errors.privacy}</p>` : ""}
      </section>

      <button class="button red" data-submit ${appState.submitting ? "disabled" : ""}>${appState.submitting ? m.submitting : m.submit}</button>
      ${appState.submitError ? `<p class="error">${escapeHtml(appState.submitError)}</p>` : ""}
    </div>
    ${appState.modalOpen ? confirmModal(finalDraft) : ""}
  `);
}

function reservationCompletePage() {
  const m = messages();
  const reservation = appState.submitted;

  return layout(`
    <div class="content-grid">
      <section class="panel emphasis">
        <span class="section-label">Complete</span>
        <h1 class="page-title">${m.complete}</h1>
        <p class="muted">${m.completeGuide}</p>
      </section>
      ${reservation
        ? `<section class="panel">${summaryHtml(reservation)}</section>`
        : `<section class="panel"><p class="muted">${m.completeRefreshHint}</p></section>`}
      <div class="form-actions" style="justify-content:flex-start">
        <a class="button primary small" href="/reservation-lookup" data-link>${m.lookup}</a>
        <a class="button small" href="/guest-reservation" data-link>${m.newReservation}</a>
        <a class="button small" href="/" data-link>${m.backHome}</a>
      </div>
    </div>
  `);
}

function guestCard(guest, isClubx) {
  const m = messages();
  const errors = appState.reservation.errors || {};
  return `
    <div class="guest-card ${isClubx ? "clubx" : ""}" data-card-id="${guest.id}">
      ${
        isClubx
          ? clubxGuestFieldHtml(guest, errors[`username-${guest.id}`])
          : `
              ${fieldHtml(m.name, "name", guest.id, guest.name, errors[`name-${guest.id}`])}
              ${fieldHtml(m.phone, "phone", guest.id, guest.phone, errors[`phone-${guest.id}`])}
            `
      }
      <button class="button small" data-delete="${guest.id}" data-type="${isClubx ? "clubx" : "guest"}">${m.delete}</button>
    </div>
  `;
}

function clubxGuestFieldHtml(guest, errorMessage) {
  const m = messages();
  if (guest.selectedUser) {
    const u = guest.selectedUser;
    const display = `${u.display_name || ""}${u.username ? ` (@${u.username})` : ""}`;
    return `
      <div class="field">
        <label>${m.username}</label>
        <div class="clubx-selected" role="status">
          <span class="clubx-selected-label">${escapeHtml(display)}</span>
          <button type="button" class="button small" data-clubx-clear="${guest.id}">${m.clubxChange}</button>
        </div>
        <span class="error">${errorMessage || ""}</span>
      </div>
    `;
  }
  const results = guest.results || [];
  const showDropdown = (guest.query || "").trim().length >= 2;
  let dropdown = "";
  if (showDropdown) {
    if (guest.searching) {
      dropdown = `<div class="clubx-dropdown"><div class="clubx-dropdown-empty">...</div></div>`;
    } else if (guest.searchError) {
      dropdown = `<div class="clubx-dropdown"><div class="clubx-dropdown-empty">${escapeHtml(guest.searchError)}</div></div>`;
    } else if (!results.length) {
      dropdown = `<div class="clubx-dropdown"><div class="clubx-dropdown-empty">${m.clubxSearchEmpty}</div></div>`;
    } else {
      dropdown = `<div class="clubx-dropdown">${results
        .map(
          (u) => `
            <button type="button" class="clubx-dropdown-item" data-clubx-pick="${guest.id}" data-user-id="${escapeHtml(u.user_id)}">
              <span class="clubx-dropdown-name">${escapeHtml(u.display_name || "")}</span>
              <span class="clubx-dropdown-username">@${escapeHtml(u.username || "")}</span>
            </button>
          `,
        )
        .join("")}</div>`;
    }
  }
  return `
    <div class="field clubx-search-field">
      <label for="clubx-search-${guest.id}">${m.username}</label>
      <input id="clubx-search-${guest.id}" data-clubx-search="${guest.id}" value="${escapeHtml(guest.query || "")}" placeholder="${m.clubxSearchPlaceholder}" autocomplete="off" aria-invalid="${errorMessage ? "true" : "false"}">
      ${dropdown}
      <span class="clubx-hint muted">${m.clubxSearchHint}</span>
      <span class="error">${errorMessage || ""}</span>
    </div>
  `;
}

function fieldHtml(label, field, id, value, error) {
  return `
    <div class="field">
      <label for="${field}-${id}">${label}</label>
      <input id="${field}-${id}" value="${escapeHtml(value)}" data-field="${field}" data-id="${id}" aria-invalid="${error ? "true" : "false"}">
      <span class="error">${error || ""}</span>
    </div>
  `;
}

function timeSlotGrid() {
  if (appState.availabilityLoading) {
    return `<div class="time-grid-wrap"><p class="muted">${messages().availabilityLoading}</p></div>`;
  }
  if (appState.availabilityError) {
    return `<div class="time-grid-wrap"><p class="error">${escapeHtml(appState.availabilityError)}</p></div>`;
  }
  const selected = appState.reservation.selectedTimeSlots;
  return `
    <div class="time-grid-wrap">
      <div class="time-grid" role="group" aria-label="${messages().timeTitle}">
        ${timeSlots
          .map((slot) => {
            const end = slotEndTime(slot);
            const isUnavailable = isSlotUnavailable(slot);
            return `
          <button class="slot-button ${selected.includes(slot) ? "selected" : ""} ${isUnavailable ? "unavailable" : ""}" data-slot="${slot}" aria-label="${slot} - ${end}" ${isUnavailable ? "disabled" : ""}>
            <span class="slot-interval" aria-hidden="true">${slot} - ${end}</span>
            <span class="slot-bar"></span>
          </button>
        `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function confirmModal(draft) {
  const m = messages();
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="modal">
        <h2 id="confirm-title">${m.confirmTitle}</h2>
        ${summaryHtml(draft)}
        <div class="modal-actions">
          <button class="button" data-close-modal>${m.cancel}</button>
          <button class="button primary" data-confirm>${m.confirm}</button>
        </div>
      </div>
    </div>
  `;
}

function lookupPage() {
  const m = messages();
  const result = appState.lookupResult;
  return layout(`
    <div class="content-grid">
      <section class="panel emphasis">
        <span class="section-label">Lookup</span>
        <h1 class="page-title">${m.lookupTitle}</h1>
        <p class="muted">${m.lookupDesc}</p>
        <div class="lookup-form">
          <div class="lookup-section">
            <h2>${m.lookupGuestGroup}</h2>
            <div class="form-grid lookup-guest-grid">
              ${fieldPlain("lookup-name", m.name, appState.lookupName || "", "lookup-name")}
              ${fieldPlain("lookup-phone", m.phone, appState.lookupPhone || "", "lookup-phone")}
            </div>
          </div>
          <div class="lookup-divider"><span>${m.lookupOr}</span></div>
          <div class="lookup-section">
            <h2>${m.lookupClubxGroup}</h2>
            ${fieldPlain("lookup-username", m.lookupUsername, appState.lookupUsername || "", "lookup-username")}
          </div>
          <button class="button primary" data-lookup>${m.checkReservation}</button>
        </div>
        ${appState.lookupMessage ? `<p class="error">${appState.lookupMessage}</p>` : ""}
      </section>
      ${result ? `<section class="panel">${summaryHtml(result)}</section>` : ""}
      <a class="button small" href="/" data-link>${m.backHome}</a>
    </div>
  `);
}

function fieldPlain(id, label, value, data) {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-${data} value="${escapeHtml(value)}"></div>`;
}

function termsPage() {
  const m = messages();
  return layout(`
    <div class="content-grid">
      <section class="panel emphasis">
        <h1 class="page-title">${m.privacyTitle}</h1>
        <div class="terms">${m.terms}</div>
      </section>
      <div class="form-actions" style="justify-content:flex-start">
        <a class="button primary small" href="/guest-reservation" data-link>${m.backReservation}</a>
        <a class="button small" href="/" data-link>${m.backHome}</a>
      </div>
    </div>
  `);
}

function faqPage() {
  const m = messages();
  return layout(`
    <div class="content-grid">
      <section class="panel emphasis">
        <h1 class="page-title">${m.faqTitle}</h1>
        <div class="card" style="margin-top:20px">
          <h3>${m.faqQ}</h3>
          <p class="muted">${m.faqA}</p>
        </div>
      </section>
      <a class="button small" href="/" data-link>${m.backHome}</a>
    </div>
  `);
}

function render() {
  const routes = {
    "/": homePage,
    "/clubx": clubxPage,
    "/guest-reservation": guestReservationPage,
    "/reservation-complete": reservationCompletePage,
    "/reservation-lookup": lookupPage,
    "/privacy-terms": termsPage,
    "/faq": faqPage,
  };
  document.getElementById("app").innerHTML = (
    routes[appState.route] || homePage
  )();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });

  document.querySelector("[data-android]")?.addEventListener("click", () => {
    appState.androidNotice = messages().androidNotice;
    render();
  });

  if (appState.route === "/guest-reservation") {
    bindReservationEvents();
    bindClubXSearchEvents();
    ensureAvailabilityLoaded();
  }
  if (appState.route === "/reservation-lookup") bindLookupEvents();
}

function bindReservationEvents() {
  const r = appState.reservation;
  document.querySelector("[data-add-guest]")?.addEventListener("click", () => {
    r.guests.push(emptyGuest());
    render();
  });

  document.querySelector("[data-add-clubx]")?.addEventListener("click", () => {
    r.clubxGuests.push(emptyClubXGuest());
    render();
  });

  document
    .querySelector("[data-has-clubx]")
    ?.addEventListener("change", (event) => {
      r.hasClubXGuests = event.target.checked;
      if (r.hasClubXGuests && !r.clubxGuests.length)
        r.clubxGuests.push(emptyClubXGuest());
      if (!r.hasClubXGuests) r.clubxGuests = [];
      render();
    });

  document
    .querySelector("[data-privacy]")
    ?.addEventListener("change", (event) => {
      r.privacyConsent = event.target.checked;
      delete r.errors.privacy;
      render();
    });

  document.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const guest = [...r.guests, ...r.clubxGuests].find(
        (item) => item.id === input.dataset.id,
      );
      if (!guest) return;
      const value =
        input.dataset.field === "phone"
          ? formatPhone(event.target.value)
          : event.target.value;
      if (input.dataset.field === "phone") event.target.value = value;
      const key =
        input.dataset.field === "username"
          ? "clubxUsername"
          : input.dataset.field;
      guest[key] = value;
      delete r.errors[`${input.dataset.field}-${guest.id}`];
      updateTotalCountDom();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.type === "clubx") {
        r.clubxGuests = r.clubxGuests.filter(
          (guest) => guest.id !== button.dataset.delete,
        );
      } else {
        r.guests = r.guests.filter(
          (guest) => guest.id !== button.dataset.delete,
        );
      }
      render();
    });
  });

  document.querySelectorAll("[data-slot]").forEach((button) => {
    button.addEventListener("click", () => selectSlot(button.dataset.slot));
  });

  document.querySelector("[data-submit]")?.addEventListener("click", () => {
    if (validateReservation()) {
      appState.modalOpen = true;
    }
    render();
  });

  document
    .querySelector("[data-close-modal]")
    ?.addEventListener("click", () => {
      appState.modalOpen = false;
      render();
    });

  document.querySelector("[data-confirm]")?.addEventListener("click", async () => {
    if (appState.submitting) return;
    let payload;
    try {
      payload = buildReservationPayload();
    } catch (err) {
      appState.submitError = err.message;
      appState.modalOpen = false;
      render();
      return;
    }
    appState.submitting = true;
    appState.submitError = "";
    render();
    try {
      const created = await apiPost("/public/pub-reservations", payload);
      const m = messages();
      appState.submitted = {
        reservation_code: created.reservation_code,
        submittedAt: new Date().toLocaleString(
          appState.lang === "ko" ? "ko-KR" : "en-US",
        ),
        time_range_display: created.time_range
          ? `${created.time_range.start_label} - ${created.time_range.end_label}`
          : timeRange(payload && appState.reservation
              ? appState.reservation.selectedTimeSlots
              : []),
        guests: (created.non_clubx_guests || []).map((g) => ({
          name: g.name,
          phone: g.phone_masked || "",
        })),
        clubxGuests: (created.clubx_guests || []).map((g) => ({
          clubxUsername: g.username,
          displayName: g.display_name,
        })),
        total_party_size: created.total_party_size,
        selectedTimeSlots: [],
      };
      try {
        sessionStorage.setItem(LAST_SUBMITTED_KEY, created.reservation_code);
      } catch {}
      appState.modalOpen = false;
      appState.submitting = false;
      initReservation();
      navigate("/reservation-complete");
    } catch (err) {
      appState.submitting = false;
      appState.modalOpen = false;
      if (err.status === 409) {
        appState.submitError = messages().soldOut;
        // Refresh availability since the grid changed.
        loadAvailabilityForCurrentPartySize();
      } else {
        appState.submitError = err.message || messages().submitError;
      }
      render();
    }
  });
}

function selectSlot(slot) {
  if (isSlotUnavailable(slot)) return;
  const r = appState.reservation;
  const clicked = timeSlots.indexOf(slot);
  if (clicked < 0) return;
  const selectedIndexes = r.selectedTimeSlots
    .map((item) => timeSlots.indexOf(item))
    .sort((a, b) => a - b);

  if (!selectedIndexes.length || selectedIndexes.includes(clicked)) {
    r.selectedTimeSlots = selectedIndexes.includes(clicked) ? [] : [slot];
  } else {
    const min = Math.min(selectedIndexes[0], clicked);
    const max = Math.max(selectedIndexes[selectedIndexes.length - 1], clicked);
    r.selectedTimeSlots = timeSlots.slice(min, max + 1);
  }

  const maxCount = getMaxSlotCount();
  if (r.selectedTimeSlots.length > maxCount)
    r.selectedTimeSlots = r.selectedTimeSlots.slice(0, maxCount);
  // Drop sold-out slots from selection silently
  r.selectedTimeSlots = r.selectedTimeSlots.filter((s) => !isSlotUnavailable(s));
  delete r.errors.time;
  // Refresh availability filtered by current party size when the selection changes.
  refreshAvailabilityForPartySize();
  render();
}

function bindLookupEvents() {
  const nameInput = document.querySelector("[data-lookup-name]");
  const phoneInput = document.querySelector("[data-lookup-phone]");
  const usernameInput = document.querySelector("[data-lookup-username]");
  nameInput?.addEventListener("input", (event) => {
    appState.lookupName = event.target.value;
  });
  phoneInput?.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
    appState.lookupPhone = event.target.value;
  });
  usernameInput?.addEventListener("input", (event) => {
    appState.lookupUsername = event.target.value;
  });
  document.querySelector("[data-lookup]")?.addEventListener("click", async () => {
    const m = messages();
    const name = (appState.lookupName || "").trim();
    const phone = formatPhone(appState.lookupPhone || "");
    const username = (appState.lookupUsername || "").trim();
    appState.lookupResult = null;
    appState.lookupMessage = "";

    let payload;
    if (username) {
      if (!validateUsername(username)) {
        appState.lookupMessage = m.validation.username;
        render();
        return;
      }
      payload = { type: "clubx", clubx_username: username };
    } else if (/^KUBA-/i.test(name) && !phone) {
      // No-op: legacy ID format; ignore
      appState.lookupMessage = m.lookupFail;
      render();
      return;
    } else {
      if (!validateName(name)) {
        appState.lookupMessage = m.validation.name;
        render();
        return;
      }
      if (!validatePhone(phone)) {
        appState.lookupMessage = m.validation.phone;
        render();
        return;
      }
      payload = { type: "guest", name, phone: normalizePhone(phone) };
    }
    if (appState.eventId) payload.event_id = appState.eventId;

    appState.lookupLoading = true;
    render();
    try {
      const response = await apiPost(
        "/public/pub-reservations/lookup",
        payload,
      );
      const items = response.reservations || [];
      if (!items.length) {
        appState.lookupMessage = m.lookupFail;
      } else {
        const first = items[0];
        appState.lookupResult = {
          reservation_code: first.reservation_code,
          submittedAt: "",
          time_range_display: first.time_range
            ? `${first.time_range.start_label} - ${first.time_range.end_label}`
            : "",
          guests: (first.non_clubx_guests || []).map((g) => ({
            name: g.name,
            phone: g.phone_masked || "",
          })),
          clubxGuests: (first.clubx_guests || []).map((g) => ({
            clubxUsername: g.username,
            displayName: g.display_name,
          })),
          total_party_size: first.total_party_size,
          selectedTimeSlots: [],
        };
      }
    } catch (err) {
      appState.lookupMessage = err.message || m.lookupFail;
    } finally {
      appState.lookupLoading = false;
      render();
    }
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (!link) return;

  event.preventDefault();
  navigate(link.getAttribute("href"));
});

window.addEventListener("popstate", () => {
  appState.route = normalizePath(window.location.pathname);
  render();
});

document.documentElement.lang = appState.lang;
if (appState.route === "/guest-reservation") initReservation();

// ---- ClubX user search & backend bootstrap ----

const clubxSearchTimers = new Map();

function bindClubXSearchEvents() {
  const r = appState.reservation;
  if (!r) return;
  document.querySelectorAll("[data-clubx-search]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const guestId = input.dataset.clubxSearch;
      const guest = r.clubxGuests.find((g) => g.id === guestId);
      if (!guest) return;
      guest.query = event.target.value;
      guest.searchError = "";
      delete r.errors[`username-${guest.id}`];
      const query = guest.query.trim();
      if (clubxSearchTimers.has(guestId)) {
        clearTimeout(clubxSearchTimers.get(guestId));
      }
      if (query.length < 2) {
        guest.results = [];
        guest.searching = false;
        renderClubXGuest(guest);
        return;
      }
      guest.searching = true;
      renderClubXGuest(guest);
      const token = ++guest.searchToken;
      const timer = setTimeout(async () => {
        try {
          const data = await apiGet(
            `/public/pub-reservations/clubx-users/search?query=${encodeURIComponent(query)}`,
          );
          if (token !== guest.searchToken) return;
          guest.results = (data && data.results) || [];
          guest.searching = false;
          guest.searchError = "";
        } catch (err) {
          if (token !== guest.searchToken) return;
          guest.results = [];
          guest.searching = false;
          guest.searchError = err.message || messages().clubxSearchError;
        } finally {
          renderClubXGuest(guest);
        }
      }, 300);
      clubxSearchTimers.set(guestId, timer);
    });
  });

  document.querySelectorAll("[data-clubx-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const guestId = button.dataset.clubxPick;
      const userId = button.dataset.userId;
      const guest = r.clubxGuests.find((g) => g.id === guestId);
      if (!guest) return;
      const user = (guest.results || []).find((u) => u.user_id === userId);
      if (!user) return;
      guest.selectedUser = user;
      guest.query = `${user.display_name || ""} (@${user.username || ""})`;
      guest.results = [];
      delete r.errors[`username-${guest.id}`];
      render();
    });
  });

  document.querySelectorAll("[data-clubx-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const guestId = button.dataset.clubxClear;
      const guest = r.clubxGuests.find((g) => g.id === guestId);
      if (!guest) return;
      guest.selectedUser = null;
      guest.query = "";
      guest.results = [];
      render();
    });
  });
}

function renderClubXGuest(guest) {
  // Re-render the entire form is the simplest path since search results affect layout.
  // Preserve input focus on the search field for the guest being edited.
  const activeId = document.activeElement && document.activeElement.id;
  const selectionStart =
    document.activeElement && "selectionStart" in document.activeElement
      ? document.activeElement.selectionStart
      : null;
  render();
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus();
      if (selectionStart !== null && "setSelectionRange" in next) {
        try {
          next.setSelectionRange(selectionStart, selectionStart);
        } catch {}
      }
    }
  }
}

async function bootstrapConfig() {
  if (appState.configLoaded) return;
  try {
    const cfg = await apiGet("/public/pub-reservations/config");
    appState.eventId = cfg.event_id || null;
    appState.serviceDate = cfg.service_date || null;
    appState.slotIntervalMinutes = cfg.slot_interval_minutes || 30;
    appState.minBookingMinutes = cfg.min_booking_minutes || 60;
    appState.maxBookingMinutes = cfg.max_booking_minutes || 90;
    appState.configLoaded = true;
    appState.configError = "";
  } catch (err) {
    appState.configError = err.message || messages().configError;
  }
}

async function ensureAvailabilityLoaded() {
  if (!appState.configLoaded) {
    await bootstrapConfig();
    if (!appState.configLoaded) {
      render();
      return;
    }
  }
  if (
    appState.availability ||
    appState.availabilityLoading ||
    !appState.eventId
  ) {
    return;
  }
  await loadAvailabilityForCurrentPartySize();
}

async function loadAvailabilityForCurrentPartySize() {
  if (!appState.eventId) return;
  const partySize = Math.max(
    1,
    appState.reservation
      ? completedGuestCount(appState.reservation) || 1
      : 1,
  );
  appState.availabilityLoading = true;
  appState.availabilityError = "";
  appState.availabilityPartySize = partySize;
  render();
  try {
    const data = await apiGet(
      `/public/pub-reservations/events/${encodeURIComponent(appState.eventId)}/availability?party_size=${partySize}`,
    );
    applyAvailability(data);
  } catch (err) {
    appState.availabilityError = err.message || messages().availabilityError;
  } finally {
    appState.availabilityLoading = false;
    render();
  }
}

function applyAvailability(data) {
  appState.availability = data;
  appState.serviceDate = data.service_date || appState.serviceDate;
  if (data.slot_interval_minutes)
    appState.slotIntervalMinutes = data.slot_interval_minutes;
  blockMap = {};
  const labels = [];
  (data.blocks || []).forEach((block) => {
    const label = block.start_label || minuteToLabel(block.start_minute);
    labels.push(label);
    blockMap[label] = {
      id: block.block_id,
      start_minute: block.start_minute,
      end_minute: block.end_minute,
      status: block.status,
      remaining_tables: block.remaining_tables,
    };
  });
  if (labels.length) timeSlots = labels;
  // Drop any currently-selected slots that no longer exist or are sold out.
  if (appState.reservation) {
    appState.reservation.selectedTimeSlots = appState.reservation.selectedTimeSlots.filter(
      (s) => timeSlots.includes(s) && !isSlotUnavailable(s),
    );
  }
}

let partySizeRefreshTimer = null;
function refreshAvailabilityForPartySize() {
  if (!appState.eventId || !appState.reservation) return;
  const partySize = completedGuestCount(appState.reservation) || 1;
  if (partySize === appState.availabilityPartySize) return;
  if (partySizeRefreshTimer) clearTimeout(partySizeRefreshTimer);
  partySizeRefreshTimer = setTimeout(() => {
    loadAvailabilityForCurrentPartySize();
  }, 250);
}

bootstrapConfig().finally(() => render());
render();
