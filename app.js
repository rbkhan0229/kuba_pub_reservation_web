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
  reservationMode: "advance",
  waitlist: null,
  lookupResult: null,
  lookupMode: "advance",
  waitlistLookupResult: null,
  lookupMessage: "",
  waitlistLookupMessage: "",
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
  waitlistSubmitting: false,
  waitlistSubmitError: "",
  waitlistLookupLoading: false,
  advanceClosed: false,
};

// 30-minute time-grid runtime state, populated from backend availability.
let timeSlots = [];
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

const emptyWaitlist = () => ({
  name: "",
  phone: "",
  partySize: "2",
  preferredRange: "",
  privacyConsent: false,
  errors: {},
  result: null,
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
    timeTitle: "예약 시간 선택",
    timeHelp: "30분 단위로 연속된 시간을 선택해주세요. 최소 1시간, 최대 1시간 30분까지 가능합니다.",
    advanceLabel: "사전예약",
    walkinAvailable: "현장 대기번호 발급 가능",
    soldOutBadge: "마감",
    openBadge: "예약 가능",
    walkinTitle: "현장 대기번호 발급",
    walkinDesc: "사전예약 테이블이 모두 마감된 경우, 현장 대기번호를 발급받아 현장 입장 안내를 받을 수 있습니다.",
    walkinGoto: "현장 대기번호 발급하기",
    waitlistMyNumber: "내 대기번호",
    waitlistCurrentCalled: "현재 호출 번호",
    waitlistRemaining: "내 앞 대기 인원",
    waitlistLookupTitle: "현장 대기번호 조회",
    waitlistLookupCta: "대기번호 조회하기",
    waitlistLookupFail: "대기번호를 찾을 수 없습니다.",
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
      minParty: "예약은 최소 2명부터 가능합니다.",
      timeShort: "이용시간은 최소 1시간 이상 선택해야 합니다.",
      timeLong: "이용시간은 최대 1시간 30분까지 선택할 수 있습니다.",
      privacy: "개인정보 활용 동의가 필요합니다.",
    },
    selfCancelButton: "예약 취소",
    selfCancelConfirm: "정말 예약을 취소하시겠습니까?",
    selfCancelSuccess: "예약이 취소되었습니다.",
    selfCancelFail: "예약 취소에 실패했습니다.",
    selfCancelAlreadyDone: "이미 취소된 예약입니다.",
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
    noWindows: "예약 가능한 시간이 아직 설정되지 않았습니다.",
    advanceTab: "사전예약",
    walkinTab: "현장대기",
    groupedAdvanceTitle: "빠른 사전예약 시간",
    flexibleAdvanceTitle: "21:00 이후 30분 단위 선택",
    remainingAdvance: (n) => `남은 사전예약: ${n}테이블`,
    advanceClosedTitle: "사전예약이 마감되었습니다.",
    advanceClosedBody: "현장대기를 이용해주세요.",
    waitlistName: "이름",
    waitlistPhone: "전화번호",
    waitlistPartySize: "인원 수",
    waitlistPreferredTime: "선호 시간대",
    waitlistNoPreference: "선호 시간 없음",
    waitlistNotGuaranteed:
      "현장대기는 입장을 보장하지 않습니다. 현장 상황과 회전 속도에 따라 입장이 어려울 수 있습니다.",
    waitlistPrivacyAgree: "현장대기 운영을 위한 개인정보 활용에 동의합니다.",
    waitlistSubmit: "대기번호 발급하기",
    waitlistSubmitting: "대기번호 발급 중...",
    waitlistSubmitError: "대기번호 발급에 실패했습니다.",
    waitlistCompleteTitle: "대기번호가 발급되었습니다.",
    waitlistCode: "대기 코드",
    waitlistQueueNumber: "대기번호",
    waitlistStatus: "상태",
    waitlistPreferredTimeLabel: "선호 시간",
    lookupAdvanceTab: "사전예약 조회",
    lookupWalkinTab: "현장대기 조회",
    lookupLoadingLabel: "조회 중...",
    waitlistLookupLoadingLabel: "대기번호 조회 중...",
    waitlistLookupCodeOrPhone: "대기 코드 또는 전화번호를 입력해주세요.",
    waitlistLookupCode: "대기 코드",
    waitlistLookupPhone: "전화번호",
    waitlistLookupName: "이름 (선택)",
    checkWaitlist: "현장대기 조회하기",
    statusLabels: {
      submitted: "예약 접수",
      checked_in: "입장 완료",
      cancelled: "취소됨",
      waiting: "대기 중",
      called: "호출됨",
      seated: "착석",
      no_show: "노쇼",
      left: "퇴장",
    },
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
    timeTitle: "Select Reservation Time",
    timeHelp:
      "Select continuous 30-minute slots. Reservations must be 1 hour to 1 hour 30 minutes.",
    advanceLabel: "Advance",
    walkinAvailable: "Walk-in waitlist available",
    soldOutBadge: "Sold out",
    openBadge: "Available",
    walkinTitle: "Walk-in Waitlist",
    walkinDesc: "When advance tables are sold out you can take a walk-in waitlist number.",
    walkinGoto: "Get a walk-in number",
    waitlistMyNumber: "My number",
    waitlistCurrentCalled: "Now calling",
    waitlistRemaining: "Ahead of me",
    waitlistLookupTitle: "Check Walk-in Number",
    waitlistLookupCta: "Look up number",
    waitlistLookupFail: "Number not found.",
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
      minParty: "Reservations require at least 2 guests.",
      timeShort: "Please select at least 1 hour.",
      timeLong: "Please select up to 1 hour 30 minutes.",
      privacy: "Privacy consent is required.",
    },
    selfCancelButton: "Cancel Reservation",
    selfCancelConfirm: "Are you sure you want to cancel this reservation?",
    selfCancelSuccess: "Your reservation has been cancelled.",
    selfCancelFail: "Failed to cancel the reservation.",
    selfCancelAlreadyDone: "This reservation has already been cancelled.",
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
    noWindows: "Reservation time slots are not configured yet.",
    advanceTab: "Advance Reservation",
    walkinTab: "Walk-in Waitlist",
    groupedAdvanceTitle: "Quick advance reservation times",
    flexibleAdvanceTitle: "30-minute selection after 21:00",
    remainingAdvance: (n) => `Advance remaining: ${n} tables`,
    advanceClosedTitle: "Advance reservation is closed.",
    advanceClosedBody: "Please use the walk-in waitlist.",
    waitlistName: "Name",
    waitlistPhone: "Phone Number",
    waitlistPartySize: "Party Size",
    waitlistPreferredTime: "Preferred Time",
    waitlistNoPreference: "No preference",
    waitlistNotGuaranteed:
      "Walk-in waitlist does not guarantee entry. Entry may not be possible depending on on-site conditions and table turnover.",
    waitlistPrivacyAgree:
      "I agree to the use of my personal information for walk-in waitlist operation.",
    waitlistSubmit: "Issue Waitlist Number",
    waitlistSubmitting: "Issuing waitlist number...",
    waitlistSubmitError: "Failed to issue a waitlist number.",
    waitlistCompleteTitle: "Your waitlist number has been issued.",
    waitlistCode: "Waitlist Code",
    waitlistQueueNumber: "Queue Number",
    waitlistStatus: "Status",
    waitlistPreferredTimeLabel: "Preferred Time",
    lookupAdvanceTab: "Advance Reservation Lookup",
    lookupWalkinTab: "Walk-in Waitlist Lookup",
    lookupLoadingLabel: "Looking up...",
    waitlistLookupLoadingLabel: "Checking waitlist...",
    waitlistLookupCodeOrPhone: "Enter a waitlist code or phone number.",
    waitlistLookupCode: "Waitlist Code",
    waitlistLookupPhone: "Phone Number",
    waitlistLookupName: "Name (optional)",
    checkWaitlist: "Check Waitlist",
    statusLabels: {
      submitted: "Submitted",
      checked_in: "Checked in",
      cancelled: "Cancelled",
      waiting: "Waiting",
      called: "Called",
      seated: "Seated",
      no_show: "No-show",
      left: "Left",
    },
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

function initWaitlist() {
  appState.waitlist = emptyWaitlist();
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
  if (normalizedPath === "/guest-reservation") {
    if (!appState.reservation) initReservation();
    if (!appState.waitlist) initWaitlist();
  }
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

// Display a phone value as-is when it's already masked (contains *).
function displayPhone(value) {
  if (!value) return "";
  const str = String(value);
  if (str.includes("*")) return str;
  return formatPhone(str);
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
  return block.status !== "available";
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
  const first = blockMap[slots[0]];
  const last = blockMap[slots[slots.length - 1]];
  if (first && last) {
    const startLabel = first.start_label || minuteToLabel(first.start_minute);
    const endLabel = last.end_label || minuteToLabel(last.end_minute);
    if (first.window_label) {
      return `${first.window_label} (${startLabel} - ${endLabel})`;
    }
    return `${startLabel} - ${endLabel}`;
  }
  return slots.join(", ");
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

const ADVANCE_GROUPS = [
  { id: "early", label: "18:00 - 19:30", start: 1080, end: 1170 },
  { id: "prime", label: "19:30 - 21:00", start: 1170, end: 1260 },
];

function blocksInRange(startMinute, endMinute) {
  return timeSlots
    .map((slot) => blockMap[slot])
    .filter(
      (block) =>
        block &&
        block.start_minute >= startMinute &&
        block.end_minute <= endMinute,
    )
    .sort((a, b) => a.start_minute - b.start_minute);
}

function slotsInRange(startMinute, endMinute) {
  return blocksInRange(startMinute, endMinute).map(
    (block) => block.start_label || minuteToLabel(block.start_minute),
  );
}

function rangeRemaining(startMinute, endMinute) {
  const blocks = blocksInRange(startMinute, endMinute);
  const expected = (endMinute - startMinute) / getSlotInterval();
  if (blocks.length !== expected) return 0;
  if (blocks.some((block) => block.status !== "available")) return 0;
  return Math.min(
    ...blocks.map((block) =>
      typeof block.remaining_tables === "number" ? block.remaining_tables : 0,
    ),
  );
}

function isAdvanceClosed() {
  return Boolean(
    appState.advanceClosed ||
      (appState.availability && appState.availability.advance_closed),
  );
}

function selectedRangeMatches(startMinute, endMinute) {
  const r = appState.reservation;
  if (!r || !r.selectedTimeSlots.length) return false;
  const first = blockMap[r.selectedTimeSlots[0]];
  const last = blockMap[r.selectedTimeSlots[r.selectedTimeSlots.length - 1]];
  return Boolean(
    first &&
      last &&
      first.start_minute === startMinute &&
      last.end_minute === endMinute,
  );
}

function preferredTimeOptions() {
  const options = [...ADVANCE_GROUPS];
  const starts = blocksInRange(1260, 2880).map((block) => block.start_minute);
  starts.forEach((start) => {
    [60, 90].forEach((duration) => {
      const end = start + duration;
      const blocks = blocksInRange(start, end);
      const expected = duration / getSlotInterval();
      if (blocks.length === expected) {
        options.push({
          id: `${start}-${end}`,
          label: `${minuteToLabel(start)} - ${minuteToLabel(end)}`,
          start,
          end,
        });
      }
    });
  });
  const seen = new Set();
  return options.filter((option) => {
    const key = `${option.start}-${option.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseRangeValue(value) {
  const match = String(value || "").match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
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
  else if (total < 2) errors.general = m.validation.minParty;
  if (isAdvanceClosed()) errors.time = m.advanceClosedTitle;
  const minSlots = getMinSlotCount();
  const maxSlots = getMaxSlotCount();
  if (r.selectedTimeSlots.length < minSlots) errors.time = m.validation.timeShort;
  if (r.selectedTimeSlots.length > maxSlots) errors.time = m.validation.timeLong;
  const selectedIndexes = r.selectedTimeSlots.map((slot) => timeSlots.indexOf(slot));
  const hasGap = selectedIndexes.some(
    (index, position) =>
      index < 0 || (position > 0 && index !== selectedIndexes[position - 1] + 1),
  );
  if (r.selectedTimeSlots.length && hasGap) errors.time = m.validation.timeShort;
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
  const first = blockMap[r.selectedTimeSlots[0]];
  const last = blockMap[r.selectedTimeSlots[r.selectedTimeSlots.length - 1]];
  if (!first || !last || isSlotUnavailable(r.selectedTimeSlots[0])) {
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
            `<li>${escapeHtml(g.name || "")}${g.phone ? ` · ${escapeHtml(displayPhone(g.phone))}` : ""}</li>`,
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

function statusLabel(status) {
  const labels = messages().statusLabels || {};
  return labels[status] || status || "—";
}

function waitlistResultHtml(result) {
  const m = messages();
  const preferred = result.preferred_time_range
    ? `${result.preferred_time_range.start_label} - ${result.preferred_time_range.end_label}`
    : m.waitlistNoPreference;
  return `
    <div class="waitlist-summary">
      <div>
        <span class="section-label">${m.waitlistCompleteTitle}</span>
        <div class="waitlist-big-number">#${escapeHtml(result.queue_number || "—")}</div>
      </div>
      <div class="waitlist-row"><span>${m.waitlistCode}</span><strong>${escapeHtml(result.waiting_code || "—")}</strong></div>
      <div class="waitlist-row"><span>${m.waitlistQueueNumber}</span><strong>${escapeHtml(result.queue_number || "—")}</strong></div>
      <div class="waitlist-row"><span>${m.waitlistCurrentCalled}</span><strong>${escapeHtml(result.current_called_number ?? "—")}</strong></div>
      <div class="waitlist-row"><span>${m.waitlistRemaining}</span><strong>${escapeHtml(result.remaining_before_me ?? "—")}</strong></div>
      <div class="waitlist-row"><span>${m.waitlistStatus}</span><strong>${escapeHtml(statusLabel(result.status))}</strong></div>
      <div class="waitlist-row"><span>${m.waitlistPreferredTimeLabel}</span><strong>${escapeHtml(preferred)}</strong></div>
      ${result.contact_phone_masked ? `<div class="waitlist-row"><span>${m.phone}</span><strong>${escapeHtml(displayPhone(result.contact_phone_masked))}</strong></div>` : ""}
      ${result.message ? `<p class="muted">${escapeHtml(result.message)}</p>` : ""}
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

function reservationModeTabs() {
  const m = messages();
  return `
    <div class="reservation-mode-tabs" role="tablist" aria-label="Reservation mode">
      <button class="reservation-mode-tab ${appState.reservationMode === "advance" ? "active" : ""}" data-reservation-mode="advance" type="button">${m.advanceTab}</button>
      <button class="reservation-mode-tab ${appState.reservationMode === "walkin" ? "active" : ""}" data-reservation-mode="walkin" type="button">${m.walkinTab}</button>
    </div>
  `;
}

function guestReservationPage() {
  if (!appState.reservation) initReservation();
  if (!appState.waitlist) initWaitlist();
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
      ${appState.reservationMode === "advance" ? `<div class="total-pill" data-total-count>${m.total(totalGuestCount)}</div>` : ""}
    </div>
    ${reservationModeTabs()}
    ${
      appState.reservationMode === "walkin"
        ? waitlistFormHtml()
        : advanceReservationHtml(finalDraft)
    }
  `);
}

function advanceReservationHtml(finalDraft) {
  const m = messages();
  const r = appState.reservation;
  if (isAdvanceClosed()) {
    return `
      <div class="content-grid">
        <section class="panel closed-notice">
          <h2>${m.advanceClosedTitle}</h2>
          <p>${m.advanceClosedBody}</p>
          <button class="button primary small" data-reservation-mode="walkin" type="button">${m.walkinTab}</button>
        </section>
      </div>
    `;
  }
  return `
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
  `;
}

function waitlistFormHtml() {
  const m = messages();
  const w = appState.waitlist || emptyWaitlist();
  const result = w.result;
  const options = preferredTimeOptions();
  return `
    <div class="content-grid">
      <section class="panel">
        <h2>${m.walkinTitle}</h2>
        <p class="muted">${m.waitlistNotGuaranteed}</p>
        <div class="form-grid" style="margin-top:18px">
          ${waitlistField("waitlist-name", m.waitlistName, w.name, "waitlist-name")}
          ${waitlistField("waitlist-phone", m.waitlistPhone, w.phone, "waitlist-phone")}
          ${waitlistField("waitlist-party", m.waitlistPartySize, w.partySize, "waitlist-party", "number", "2")}
          <div class="field">
            <label for="waitlist-preferred">${m.waitlistPreferredTime}</label>
            <select id="waitlist-preferred" data-waitlist-preferred>
              <option value="">${m.waitlistNoPreference}</option>
              ${options.map((option) => `<option value="${option.start}-${option.end}" ${w.preferredRange === `${option.start}-${option.end}` ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </div>
        </div>
        ${w.errors.general ? `<p class="error">${w.errors.general}</p>` : ""}
      </section>

      <section class="panel">
        <div class="form-actions" style="justify-content:flex-start;margin-top:0">
          <a class="button small" href="/privacy-terms" data-link>${m.privacyView}</a>
        </div>
        <label class="checkbox-row" style="margin-top:16px">
          <input type="checkbox" data-waitlist-privacy ${w.privacyConsent ? "checked" : ""}>
          <span>${m.waitlistPrivacyAgree}</span>
        </label>
        ${w.errors.privacy ? `<p class="error">${w.errors.privacy}</p>` : ""}
      </section>

      <button class="button red" data-waitlist-submit ${appState.waitlistSubmitting ? "disabled" : ""}>${appState.waitlistSubmitting ? m.waitlistSubmitting : m.waitlistSubmit}</button>
      ${appState.waitlistSubmitError ? `<p class="error">${escapeHtml(appState.waitlistSubmitError)}</p>` : ""}
      ${result ? `<section class="panel waitlist-result">${waitlistResultHtml(result)}</section>` : ""}
    </div>
  `;
}

function waitlistField(id, label, value, data, type = "text", min = "") {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" ${min ? `min="${min}"` : ""} value="${escapeHtml(value)}" data-${data}>
    </div>
  `;
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
  if (appState.configError) {
    return `<div class="time-grid-wrap"><p class="error">${escapeHtml(appState.configError)}</p></div>`;
  }
  if (!appState.configLoaded) {
    return `<div class="time-grid-wrap"><p class="muted">${messages().availabilityLoading}</p></div>`;
  }
  if (appState.availabilityLoading) {
    return `<div class="time-grid-wrap"><p class="muted">${messages().availabilityLoading}</p></div>`;
  }
  if (appState.availabilityError) {
    return `<div class="time-grid-wrap"><p class="error">${escapeHtml(appState.availabilityError)}</p></div>`;
  }
  const m = messages();
  if (!timeSlots.length) {
    return `<div class="time-grid-wrap"><p class="muted">${m.noWindows}</p></div>`;
  }
  const selected = appState.reservation.selectedTimeSlots;
  const flexibleSlots = timeSlots.filter((slot) => {
    const block = blockMap[slot];
    return block && block.start_minute >= 1260;
  });
  return `
    <div class="time-grid-wrap">
      <h3 class="advance-section-title">${m.groupedAdvanceTitle}</h3>
      <div class="advance-group-grid">
        ${ADVANCE_GROUPS.map((group) => {
          const remaining = rangeRemaining(group.start, group.end);
          const unavailable = remaining <= 0;
          const selectedGroup = selectedRangeMatches(group.start, group.end);
          return `
            <button class="advance-option-card ${selectedGroup ? "selected" : ""} ${unavailable ? "unavailable" : ""}" data-advance-group="${group.id}" ${unavailable ? "disabled" : ""} type="button">
              <span class="advance-option-time">${escapeHtml(group.label)}</span>
              <span class="advance-option-remaining">${unavailable ? m.soldOutBadge : m.remainingAdvance(remaining)}</span>
            </button>
          `;
        }).join("")}
      </div>
      <h3 class="advance-section-title">${m.flexibleAdvanceTitle}</h3>
      <div class="time-grid" role="group" aria-label="${m.timeTitle}">
        ${flexibleSlots
          .map((slot) => {
            const block = blockMap[slot] || {};
            const isUnavailable = isSlotUnavailable(slot);
            const remaining = typeof block.remaining_tables === "number" ? block.remaining_tables : null;
            const isSelected = selected.includes(slot);
            return `
          <button class="slot-button ${isSelected ? "selected" : ""} ${isUnavailable ? "unavailable" : ""}" data-slot="${escapeHtml(slot)}" ${isUnavailable ? "disabled" : ""}>
            <span class="slot-interval">${escapeHtml(block.start_label || slot)}<br>${escapeHtml(block.end_label || slotEndTime(slot))}</span>
            <span class="slot-bar" aria-hidden="true"></span>
            <span class="slot-remaining">${isUnavailable ? m.soldOutBadge : `${remaining !== null ? remaining : "?"}T`}</span>
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
        <div class="reservation-mode-tabs lookup-tabs" role="tablist" aria-label="Lookup mode">
          <button class="reservation-mode-tab ${appState.lookupMode === "advance" ? "active" : ""}" data-lookup-mode="advance" type="button">${m.lookupAdvanceTab}</button>
          <button class="reservation-mode-tab ${appState.lookupMode === "walkin" ? "active" : ""}" data-lookup-mode="walkin" type="button">${m.lookupWalkinTab}</button>
        </div>
        ${appState.lookupMode === "walkin" ? waitlistLookupFormHtml() : advanceLookupFormHtml()}
      </section>
      ${appState.lookupMode === "advance" && result ? `<section class="panel">${summaryHtml(result)}${
        result.status === "submitted"
          ? `<div class="form-actions" style="margin-top:16px"><button class="button red" data-cancel-reservation>${m.selfCancelButton}</button></div>`
          : result.status === "cancelled"
            ? `<p class="muted" style="margin-top:12px">${m.selfCancelAlreadyDone}</p>`
            : ""
      }</section>` : ""}
      ${appState.lookupMode === "walkin" && appState.waitlistLookupResult ? `<section class="panel waitlist-result">${waitlistResultHtml(appState.waitlistLookupResult)}</section>` : ""}
      <a class="button small" href="/" data-link>${m.backHome}</a>
    </div>
  `);
}

function advanceLookupFormHtml() {
  const m = messages();
  return `
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
      <button class="button primary" data-lookup>${appState.lookupLoading ? m.lookupLoadingLabel : m.checkReservation}</button>
    </div>
    ${appState.lookupMessage ? `<p class="error">${appState.lookupMessage}</p>` : ""}
  `;
}

function waitlistLookupFormHtml() {
  const m = messages();
  return `
    <div class="lookup-form">
      <div class="lookup-section">
        <h2>${m.lookupWalkinTab}</h2>
        <div class="form-grid lookup-guest-grid">
          ${fieldPlain("waitlist-lookup-code", m.waitlistLookupCode, appState.waitlistLookupCode || "", "waitlist-lookup-code")}
          ${fieldPlain("waitlist-lookup-phone", m.waitlistLookupPhone, appState.waitlistLookupPhone || "", "waitlist-lookup-phone")}
          ${fieldPlain("waitlist-lookup-name", m.waitlistLookupName, appState.waitlistLookupName || "", "waitlist-lookup-name")}
        </div>
      </div>
      <button class="button primary" data-waitlist-lookup>${appState.waitlistLookupLoading ? m.waitlistLookupLoadingLabel : m.checkWaitlist}</button>
    </div>
    ${appState.waitlistLookupMessage ? `<p class="error">${appState.waitlistLookupMessage}</p>` : ""}
  `;
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
    bindReservationModeEvents();
    if (appState.reservationMode === "walkin") {
      bindWaitlistEvents();
    } else {
      bindReservationEvents();
      bindClubXSearchEvents();
    }
    ensureAvailabilityLoaded();
  }
  if (appState.route === "/reservation-lookup") bindLookupEvents();
}

function bindReservationModeEvents() {
  document.querySelectorAll("[data-reservation-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.reservationMode = button.dataset.reservationMode || "advance";
      appState.submitError = "";
      appState.waitlistSubmitError = "";
      render();
    });
  });
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

  document.querySelectorAll("[data-advance-group]").forEach((button) => {
    button.addEventListener("click", () =>
      selectAdvanceGroup(button.dataset.advanceGroup),
    );
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

function validateWaitlist() {
  const m = messages();
  const w = appState.waitlist;
  const errors = {};
  if (!validateName(w.name || "")) errors.general = m.validation.name;
  if (!validatePhone(w.phone || "")) errors.general = m.validation.phone;
  const partySize = Number(w.partySize || 0);
  if (!partySize || partySize < 2) errors.general = m.validation.minParty;
  if (!w.privacyConsent) errors.privacy = m.validation.privacy;
  w.errors = errors;
  return Object.keys(errors).length === 0;
}

function bindWaitlistEvents() {
  const w = appState.waitlist;
  document.querySelector("[data-waitlist-name]")?.addEventListener("input", (event) => {
    w.name = event.target.value;
    delete w.errors.general;
  });
  document.querySelector("[data-waitlist-phone]")?.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
    w.phone = event.target.value;
    delete w.errors.general;
  });
  document.querySelector("[data-waitlist-party]")?.addEventListener("input", (event) => {
    w.partySize = event.target.value;
    delete w.errors.general;
  });
  document.querySelector("[data-waitlist-preferred]")?.addEventListener("change", (event) => {
    w.preferredRange = event.target.value;
  });
  document
    .querySelector("[data-waitlist-privacy]")
    ?.addEventListener("change", (event) => {
      w.privacyConsent = event.target.checked;
      delete w.errors.privacy;
      render();
    });
  document.querySelector("[data-waitlist-submit]")?.addEventListener("click", async () => {
    if (!validateWaitlist()) {
      render();
      return;
    }
    if (!appState.eventId) {
      appState.waitlistSubmitError = messages().configError;
      render();
      return;
    }
    const range = parseRangeValue(w.preferredRange);
    const payload = {
      event_id: appState.eventId,
      name: w.name.trim(),
      phone: normalizePhone(w.phone),
      party_size: Number(w.partySize),
      privacy_consent: true,
      locale: appState.lang,
    };
    if (range) {
      payload.preferred_start_minute = range.start;
      payload.preferred_end_minute = range.end;
    }
    appState.waitlistSubmitting = true;
    appState.waitlistSubmitError = "";
    render();
    try {
      const created = await apiPost("/public/pub-reservations/waitlist", payload);
      appState.waitlist.result = created;
    } catch (err) {
      appState.waitlistSubmitError = err.message || messages().waitlistSubmitError;
    } finally {
      appState.waitlistSubmitting = false;
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
    .map((selected) => timeSlots.indexOf(selected))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const maxSlots = getMaxSlotCount();

  if (!selectedIndexes.length) {
    r.selectedTimeSlots = [slot];
  } else if (selectedIndexes.includes(clicked)) {
    const first = selectedIndexes[0];
    const last = selectedIndexes[selectedIndexes.length - 1];
    if (selectedIndexes.length === 1) {
      r.selectedTimeSlots = [];
    } else if (clicked === first) {
      r.selectedTimeSlots = selectedIndexes.slice(1).map((index) => timeSlots[index]);
    } else if (clicked === last) {
      r.selectedTimeSlots = selectedIndexes.slice(0, -1).map((index) => timeSlots[index]);
    } else {
      r.selectedTimeSlots = [slot];
    }
  } else {
    const first = selectedIndexes[0];
    const last = selectedIndexes[selectedIndexes.length - 1];
    const rangeStart = Math.min(first, clicked);
    const rangeEnd = Math.max(last, clicked);
    const proposed = timeSlots.slice(rangeStart, rangeEnd + 1);
    const isContinuousExtension = clicked === first - 1 || clicked === last + 1;
    const fitsMax = proposed.length <= maxSlots;
    const hasUnavailable = proposed.some((candidate) => isSlotUnavailable(candidate));
    if (isContinuousExtension && fitsMax && !hasUnavailable) {
      r.selectedTimeSlots = proposed;
    } else {
      r.selectedTimeSlots = [slot];
    }
  }
  r.selectedTimeSlots = r.selectedTimeSlots.filter((s) => !isSlotUnavailable(s));
  delete r.errors.time;
  refreshAvailabilityForPartySize();
  render();
}

function selectAdvanceGroup(groupId) {
  const group = ADVANCE_GROUPS.find((item) => item.id === groupId);
  if (!group || rangeRemaining(group.start, group.end) <= 0) return;
  const r = appState.reservation;
  const slots = slotsInRange(group.start, group.end);
  if (!slots.length || slots.some((slot) => isSlotUnavailable(slot))) return;
  r.selectedTimeSlots = slots;
  delete r.errors.time;
  refreshAvailabilityForPartySize();
  render();
}

function bindLookupEvents() {
  document.querySelectorAll("[data-lookup-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.lookupMode = button.dataset.lookupMode || "advance";
      appState.lookupMessage = "";
      appState.waitlistLookupMessage = "";
      render();
    });
  });

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

  document.querySelector("[data-waitlist-lookup-code]")?.addEventListener("input", (event) => {
    appState.waitlistLookupCode = event.target.value;
  });
  document.querySelector("[data-waitlist-lookup-phone]")?.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
    appState.waitlistLookupPhone = event.target.value;
  });
  document.querySelector("[data-waitlist-lookup-name]")?.addEventListener("input", (event) => {
    appState.waitlistLookupName = event.target.value;
  });

  document.querySelector("[data-waitlist-lookup]")?.addEventListener("click", async () => {
    const m = messages();
    const waitingCode = (appState.waitlistLookupCode || "").trim();
    const phone = formatPhone(appState.waitlistLookupPhone || "");
    const name = (appState.waitlistLookupName || "").trim();
    appState.waitlistLookupResult = null;
    appState.waitlistLookupMessage = "";
    const payload = {};
    if (waitingCode) {
      payload.waiting_code = waitingCode;
    } else if (phone) {
      if (!validatePhone(phone)) {
        appState.waitlistLookupMessage = m.validation.phone;
        render();
        return;
      }
      payload.phone = normalizePhone(phone);
      if (name) payload.name = name;
    } else {
      appState.waitlistLookupMessage = m.waitlistLookupCodeOrPhone;
      render();
      return;
    }
    appState.waitlistLookupLoading = true;
    render();
    try {
      const response = await apiPost("/public/pub-reservations/waitlist/lookup", payload);
      if (!response.found || !response.waitlist) {
        appState.waitlistLookupMessage = m.waitlistLookupFail;
      } else {
        appState.waitlistLookupResult = response.waitlist;
      }
    } catch (err) {
      appState.waitlistLookupMessage = err.message || m.waitlistLookupFail;
    } finally {
      appState.waitlistLookupLoading = false;
      render();
    }
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
          status: first.status || "submitted",
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
        appState.lookupUsedPhone = payload.type === "guest" ? payload.phone : "";
        appState.lookupUsedUsername = payload.type === "clubx" ? payload.clubx_username : "";
      }
    } catch (err) {
      appState.lookupMessage = err.message || m.lookupFail;
    } finally {
      appState.lookupLoading = false;
      render();
    }
  });

  document
    .querySelector("[data-cancel-reservation]")
    ?.addEventListener("click", async () => {
      const m2 = messages();
      const r = appState.lookupResult;
      if (!r || !r.reservation_code) return;
      if (!window.confirm(m2.selfCancelConfirm)) return;
      const cancelPayload = { reservation_code: r.reservation_code };
      if (appState.lookupUsedPhone) cancelPayload.phone = appState.lookupUsedPhone;
      else if (appState.lookupUsedUsername)
        cancelPayload.clubx_username = appState.lookupUsedUsername;
      try {
        const response = await apiPost(
          "/public/pub-reservations/cancel",
          cancelPayload,
        );
        if (response && response.ok) {
          appState.lookupResult = { ...r, status: "cancelled" };
          appState.lookupMessage = m2.selfCancelSuccess;
        } else {
          appState.lookupMessage = m2.selfCancelFail;
        }
      } catch (err) {
        appState.lookupMessage = err.message || m2.selfCancelFail;
      } finally {
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
if (appState.route === "/guest-reservation") {
  initReservation();
  initWaitlist();
}

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
    appState.advanceClosed = Boolean(cfg.advance_closed);
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
  appState.slotIntervalMinutes = data.slot_interval_minutes || appState.slotIntervalMinutes;
  appState.maxBookingMinutes = data.max_booking_minutes || appState.maxBookingMinutes;
  appState.advanceClosed = Boolean(data.advance_closed);
  blockMap = {};
  const labels = [];
  (data.blocks || []).forEach((block) => {
    const label = block.start_label || minuteToLabel(block.start_minute);
    labels.push(label);
    blockMap[label] = {
      id: block.block_id,
      start_minute: block.start_minute,
      end_minute: block.end_minute,
      start_label: block.start_label || minuteToLabel(block.start_minute),
      end_label: block.end_label || minuteToLabel(block.end_minute),
      status: block.status,
      remaining_tables: block.remaining_tables,
    };
  });
  timeSlots = labels;
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
