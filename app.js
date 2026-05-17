const STORE_KEY = "kuba_pub_reservations";

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
};

const emptyGuest = () => ({ id: crypto.randomUUID(), name: "", phone: "" });
const emptyClubXGuest = () => ({ id: crypto.randomUUID(), clubxUsername: "" });

const t = {
  ko: {
    brand: "KUBA 대동제 주점",
    brandSub: "예약 웹사이트",
    home: "Home",
    faq: "FAQ",
    lookup: "예약조회",
    checkReservation: "예약 조회하기",
    posterKicker: "Festival Pub Benefit",
    posterTitle: "ClubX 예약 혜택 이벤트",
    posterBody: [
      "KUBA 대동제 주점에서는 현장 주류 판매가 불가능하여, 기본적으로 손님이 직접 주류를 구매해 오셔야 합니다.",
      "하지만 ClubX 앱을 통해 예약한 손님에게는 소주 또는 맥주를 무료로 증정합니다.",
      "테이블 전원이 ClubX를 통해 예약한 팀에게는 술을 시원하게 보관할 수 있는 아이스 버켓도 함께 제공합니다.",
    ],
    notice: "주의사항: 현장 상황에 따라 소주 또는 맥주 중 일부 품목이 먼저 품절될 수 있습니다.",
    startTitle: "예약 방법 선택",
    startCopy: "혜택 없이 빠르게 예약하거나, ClubX 앱으로 예약하고 이벤트 혜택을 받을 수 있습니다.",
    guestCta: "혜택 받지 않고 비회원 예약",
    clubxCta: "ClubX로 예약하고 혜택 받기",
    clubxTitle: "ClubX 앱으로 예약하기",
    clubxDesc: "사용 중인 기기를 선택하면 앱 다운로드 페이지로 이동합니다.",
    ios: "iOS - CLUB X: Open Square",
    android: "Android",
    androidNotice: "Android 버전은 현재 준비 중입니다.",
    backHome: "메인으로 돌아가기",
    guestTitle: "비회원 예약",
    guestGuide: "ClubX 예약자가 있는지 먼저 알려주신 뒤, ClubX 예약자 ID와 ClubX 예약자를 제외한 비회원 인원 정보를 입력해주세요.",
    nonClubxSection: "비회원 인원",
    nonClubxGuide: "ClubX로 예약한 인원은 제외하고, 비회원 인원만 이름과 연락처를 입력해주세요.",
    addGuest: "비회원 인원 추가",
    clubxQuestion: "ClubX 예약자가 있나요?",
    clubxSection: "ClubX 예약자 ID",
    clubxGuide: "ClubX 앱에서 이미 예약한 일행의 ID만 입력해주세요.",
    addClubx: "ClubX 예약자 ID 추가",
    name: "이름",
    phone: "연락처",
    username: "ClubX ID",
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
    reservationId: "예약 ID",
    submittedAt: "신청 완료 시간",
    nonClubxGuests: "비회원 인원 정보",
    clubxGuests: "ClubX 예약자 ID",
    noGuests: "입력된 인원이 없습니다.",
    validation: {
      name: "이름에는 숫자나 특수문자를 사용할 수 없습니다.",
      phone: "올바른 연락처 형식을 입력해주세요. 예: 010-1234-5678",
      username: "ClubX ID를 입력해주세요.",
      oneGuest: "최소 1명 이상 입력해주세요.",
      timeShort: "이용시간은 최소 1시간 이상 선택해야 합니다.",
      timeLong: "이용시간은 최대 1시간 30분까지 선택할 수 있습니다.",
      privacy: "개인정보 활용 동의가 필요합니다.",
    },
    lookupTitle: "예약조회",
    lookupDesc: "예약 시 입력한 이름과 연락처로 예약 내용을 확인할 수 있습니다.",
    lookupFail: "일치하는 예약 정보를 찾을 수 없습니다.",
    privacyTitle: "개인정보 활용 동의",
    backReservation: "예약 페이지로 돌아가기",
    terms: `개인정보 활용 동의

KUBA 대동제 주점 예약 운영을 위해 아래와 같이 개인정보를 수집 및 이용합니다.

1. 수집 항목
- 이름
- 연락처
- ClubX ID: ClubX 예약자가 있는 경우에만 수집

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
    faqA: "A. ClubX 사용자들끼리 먼저 앱에서 예약한 후, 이 페이지에서 `ClubX 예약자가 있나요?`에 체크하고 ClubX 예약자 ID를 입력해주세요. 이후 ClubX 예약자를 제외한 비회원 인원만 이름과 연락처를 적어주시면 됩니다.",
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
    notice: "Notice: Depending on on-site availability, either soju or beer may run out first.",
    startTitle: "Choose Your Reservation Path",
    startCopy: "Make a quick guest reservation without benefits, or reserve through ClubX to receive event benefits.",
    guestCta: "Guest Reservation Without Benefits",
    clubxCta: "Reserve with ClubX & Get Benefits",
    clubxTitle: "Reserve through the ClubX App",
    clubxDesc: "Select your device to go to the app download page.",
    ios: "iOS - CLUB X: Open Square",
    android: "Android",
    androidNotice: "The Android version is currently in development.",
    backHome: "Back to Home",
    guestTitle: "Guest Reservation",
    guestGuide: "First tell us whether your group includes ClubX reservers, then enter their ClubX IDs and the non-ClubX guests only.",
    nonClubxSection: "Non-ClubX Guests",
    nonClubxGuide: "Exclude anyone who reserved through ClubX. Enter names and phone numbers only for non-ClubX guests.",
    addGuest: "Add Non-ClubX Guest",
    clubxQuestion: "Are there ClubX reservers?",
    clubxSection: "ClubX Reserver IDs",
    clubxGuide: "Enter only the IDs of guests who have already reserved through the ClubX app.",
    addClubx: "Add ClubX ID",
    name: "Name",
    phone: "Phone Number",
    username: "ClubX ID",
    delete: "Delete",
    total: (n) => `Total Guests: ${n}`,
    timeTitle: "Select Pub Time",
    timeHelp: "Select continuous 30-minute blocks from 1 hour up to 1 hour 30 minutes.",
    selectedTime: "Selected Time",
    noTime: "No time selected.",
    privacyView: "View Privacy Consent Terms",
    privacyAgree: "I agree to the use of my personal information for reservation confirmation and event operation.",
    submit: "Submit Reservation",
    confirmTitle: "Please Confirm Your Reservation",
    cancel: "Cancel",
    confirm: "Confirm Reservation",
    complete: "Your reservation has been submitted.",
    reservationId: "Reservation ID",
    submittedAt: "Submitted At",
    nonClubxGuests: "Non-ClubX Guest Information",
    clubxGuests: "ClubX Reserver IDs",
    noGuests: "No guests entered.",
    validation: {
      name: "Name cannot contain numbers or special characters.",
      phone: "Please enter a valid phone number. Example: 010-1234-5678",
      username: "Please enter a ClubX ID.",
      oneGuest: "Please enter at least one guest.",
      timeShort: "Please select at least 1 hour.",
      timeLong: "Please select up to 1 hour 30 minutes.",
      privacy: "Privacy consent is required.",
    },
    lookupTitle: "Check Reservation",
    lookupDesc: "Enter the name and phone number used for the reservation.",
    lookupFail: "No matching reservation was found.",
    privacyTitle: "Privacy Consent",
    backReservation: "Back to Reservation",
    terms: `Privacy Consent

For the operation of the KUBA Festival Pub reservation system, we collect and use personal information as described below.

1. Information Collected
- Name
- Phone number
- ClubX ID: collected only if there are guests who reserved through ClubX

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
    faqA: "A. ClubX users should reserve together in the app first. Then check `Are there ClubX reservers?`, enter their ClubX IDs, and enter names and phone numbers only for non-ClubX guests.",
  },
};

const timeSlots = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];

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
  history.pushState({}, "", normalizedPath);
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

function getSavedReservations() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveReservation(reservation) {
  const saved = getSavedReservations();
  saved.unshift(reservation);
  localStorage.setItem(STORE_KEY, JSON.stringify(saved));
}

function timeRange(slots) {
  if (!slots.length) return messages().noTime;
  const indexes = slots.map((slot) => timeSlots.indexOf(slot)).sort((a, b) => a - b);
  const start = timeSlots[indexes[0]];
  const last = timeSlots[indexes[indexes.length - 1]];
  const [hour, minute] = last.split(":").map(Number);
  const endDate = new Date(2026, 4, 11, hour, minute + 30);
  const end = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
  return `${start} - ${end}`;
}

function validateReservation() {
  const m = messages();
  const r = appState.reservation;
  const errors = {};

  r.guests.forEach((guest) => {
    if (!validateName(guest.name)) errors[`name-${guest.id}`] = m.validation.name;
    if (!validatePhone(guest.phone)) errors[`phone-${guest.id}`] = m.validation.phone;
  });

  r.clubxGuests.forEach((guest) => {
    if (!validateUsername(guest.clubxUsername)) errors[`username-${guest.id}`] = m.validation.username;
  });

  const total = r.guests.length + r.clubxGuests.length;
  if (total < 1) errors.general = m.validation.oneGuest;
  if (r.selectedTimeSlots.length < 2) errors.time = m.validation.timeShort;
  if (r.selectedTimeSlots.length > 3) errors.time = m.validation.timeLong;
  if (!r.privacyConsent) errors.privacy = m.validation.privacy;

  r.errors = errors;
  return Object.keys(errors).length === 0;
}

function createFinalReservation() {
  const r = appState.reservation;
  return {
    id: `KUBA-${Date.now().toString(36).toUpperCase()}`,
    submittedAt: new Date().toLocaleString(appState.lang === "ko" ? "ko-KR" : "en-US"),
    guests: copy(r.guests),
    hasClubXGuests: r.hasClubXGuests,
    clubxGuests: copy(r.clubxGuests),
    selectedTimeSlots: [...r.selectedTimeSlots],
    totalGuestCount: r.guests.length + r.clubxGuests.length,
    privacyConsent: r.privacyConsent,
  };
}

function summaryHtml(reservation) {
  const m = messages();
  const guestRows = reservation.guests.length
    ? reservation.guests.map((g) => `<li>${escapeHtml(g.name)} · ${escapeHtml(formatPhone(g.phone))}</li>`).join("")
    : `<li>${m.noGuests}</li>`;
  const clubxRows = reservation.clubxGuests.length
    ? reservation.clubxGuests.map((g) => `<li>${escapeHtml(g.clubxUsername)}</li>`).join("")
    : `<li>${m.noGuests}</li>`;

  return `
    <div class="summary">
      ${reservation.id ? `<div class="summary-block"><h3>${m.reservationId}</h3><p class="muted">${reservation.id}</p></div>` : ""}
      ${reservation.submittedAt ? `<div class="summary-block"><h3>${m.submittedAt}</h3><p class="muted">${reservation.submittedAt}</p></div>` : ""}
      <div class="summary-block"><h3>${m.selectedTime}</h3><p class="muted">${timeRange(reservation.selectedTimeSlots)}</p></div>
      <div class="summary-block"><h3>${m.nonClubxGuests}</h3><ul class="summary-list">${guestRows}</ul></div>
      <div class="summary-block"><h3>${m.clubxGuests}</h3><ul class="summary-list">${clubxRows}</ul></div>
      <div class="total-pill">${m.total(reservation.totalGuestCount || reservation.guests.length + reservation.clubxGuests.length)}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
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
            <a class="button primary" href="/guest-reservation" data-link>${m.guestCta}</a>
            <a class="button dark" href="/clubx" data-link>${m.clubxCta}</a>
          </div>
          <div class="secondary-actions">
            <a class="ghost-button nav-link" href="/faq" data-link>${m.faq}</a>
            <a class="ghost-button nav-link" href="/reservation-lookup" data-link>${m.lookup}</a>
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
  const finalDraft = {
    guests: r.guests,
    clubxGuests: r.clubxGuests,
    selectedTimeSlots: r.selectedTimeSlots,
    totalGuestCount: r.guests.length + r.clubxGuests.length,
  };

  return layout(`
    <div class="page-header">
      <div>
        <span class="section-label">Reservation</span>
        <h1 class="page-title">${m.guestTitle}</h1>
        <p class="muted">${m.guestGuide}</p>
      </div>
      <div class="total-pill">${m.total(r.guests.length + r.clubxGuests.length)}</div>
    </div>
    <div class="content-grid">
      ${appState.submitted ? `<div class="toast">${m.complete}<br>${m.reservationId}: ${appState.submitted.id}</div>` : ""}
      <section class="panel">
        <label class="checkbox-row">
          <input type="checkbox" data-has-clubx ${r.hasClubXGuests ? "checked" : ""}>
          <span>${m.clubxQuestion}</span>
        </label>
        ${r.hasClubXGuests ? `
          <div class="section-head" style="margin-top:18px">
            <h2>${m.clubxSection}</h2>
            <button class="button small dark" data-add-clubx>${m.addClubx}</button>
          </div>
          <p class="muted">${m.clubxGuide}</p>
          <div class="guest-list">
            ${r.clubxGuests.length ? r.clubxGuests.map((guest) => guestCard(guest, true)).join("") : `<div class="empty-state">${m.noGuests}</div>`}
          </div>
        ` : ""}
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>${m.nonClubxSection}</h2>
          <button class="button small primary" data-add-guest>${m.addGuest}</button>
        </div>
        <p class="muted">${m.nonClubxGuide}</p>
        <div class="guest-list">
          ${r.guests.length ? r.guests.map((guest) => guestCard(guest, false)).join("") : `<div class="empty-state">${m.noGuests}</div>`}
        </div>
        ${r.errors.general ? `<p class="error">${r.errors.general}</p>` : ""}
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

      <button class="button red" data-submit>${m.submit}</button>
    </div>
    ${appState.modalOpen ? confirmModal(finalDraft) : ""}
  `);
}

function guestCard(guest, isClubx) {
  const m = messages();
  const errors = appState.reservation.errors || {};
  return `
    <div class="guest-card ${isClubx ? "clubx" : ""}" data-card-id="${guest.id}">
      ${isClubx
        ? fieldHtml(m.username, "username", guest.id, guest.clubxUsername, errors[`username-${guest.id}`])
        : `${fieldHtml(m.name, "name", guest.id, guest.name, errors[`name-${guest.id}`])}
           ${fieldHtml(m.phone, "phone", guest.id, guest.phone, errors[`phone-${guest.id}`])}`}
      <button class="button small" data-delete="${guest.id}" data-type="${isClubx ? "clubx" : "guest"}">${m.delete}</button>
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
  const selected = appState.reservation.selectedTimeSlots;
  const unavailable = appState.reservation.unavailableTimeSlots || [];
  return `
    <div class="time-grid-wrap">
      <div class="time-grid" role="group" aria-label="${messages().timeTitle}">
        ${timeSlots.map((slot) => {
          const isSelected = selected.includes(slot);
          const isUnavailable = unavailable.includes(slot);
          return `
          <button class="slot-button ${isSelected ? "selected" : ""} ${isUnavailable ? "unavailable" : ""}" data-slot="${slot}" ${isUnavailable ? "disabled" : ""}>
            <span>${slot}</span>
            <span class="slot-bar"></span>
          </button>
        `;
        }).join("")}
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
        <div class="form-grid" style="margin-top:18px">
          ${fieldPlain("lookup-name", m.name, appState.lookupName || "", "lookup-name")}
          ${fieldPlain("lookup-phone", m.phone, appState.lookupPhone || "", "lookup-phone")}
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
    "/reservation-lookup": lookupPage,
    "/privacy-terms": termsPage,
    "/faq": faqPage,
  };
  document.getElementById("app").innerHTML = (routes[appState.route] || homePage)();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });

  document.querySelector("[data-android]")?.addEventListener("click", () => {
    appState.androidNotice = messages().androidNotice;
    render();
  });

  if (appState.route === "/guest-reservation") bindReservationEvents();
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

  document.querySelector("[data-has-clubx]")?.addEventListener("change", (event) => {
    r.hasClubXGuests = event.target.checked;
    if (r.hasClubXGuests && !r.clubxGuests.length) r.clubxGuests.push(emptyClubXGuest());
    if (!r.hasClubXGuests) r.clubxGuests = [];
    render();
  });

  document.querySelector("[data-privacy]")?.addEventListener("change", (event) => {
    r.privacyConsent = event.target.checked;
    delete r.errors.privacy;
    render();
  });

  document.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const guest = [...r.guests, ...r.clubxGuests].find((item) => item.id === input.dataset.id);
      if (!guest) return;
      const value = input.dataset.field === "phone" ? formatPhone(event.target.value) : event.target.value;
      if (input.dataset.field === "phone") event.target.value = value;
      const key = input.dataset.field === "username" ? "clubxUsername" : input.dataset.field;
      guest[key] = value;
      delete r.errors[`${input.dataset.field}-${guest.id}`];
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.type === "clubx") {
        r.clubxGuests = r.clubxGuests.filter((guest) => guest.id !== button.dataset.delete);
      } else {
        r.guests = r.guests.filter((guest) => guest.id !== button.dataset.delete);
      }
      render();
    });
  });

  document.querySelectorAll("[data-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      selectSlot(button.dataset.slot);
    });
  });

  document.querySelector("[data-submit]")?.addEventListener("click", () => {
    if (validateReservation()) {
      appState.modalOpen = true;
    }
    render();
  });

  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    appState.modalOpen = false;
    render();
  });

  document.querySelector("[data-confirm]")?.addEventListener("click", () => {
    const finalReservation = createFinalReservation();
    saveReservation(finalReservation);
    appState.submitted = finalReservation;
    appState.modalOpen = false;
    initReservation();
    render();
  });
}

function selectSlot(slot) {
  const r = appState.reservation;
  const clicked = timeSlots.indexOf(slot);
  const selectedIndexes = r.selectedTimeSlots.map((item) => timeSlots.indexOf(item)).sort((a, b) => a - b);

  if (!selectedIndexes.length || selectedIndexes.includes(clicked)) {
    r.selectedTimeSlots = selectedIndexes.includes(clicked) ? [] : [slot];
  } else {
    const min = Math.min(selectedIndexes[0], clicked);
    const max = Math.max(selectedIndexes[selectedIndexes.length - 1], clicked);
    r.selectedTimeSlots = timeSlots.slice(min, max + 1);
  }

  if (r.selectedTimeSlots.length > 3) r.selectedTimeSlots = r.selectedTimeSlots.slice(0, 3);
  delete r.errors.time;
  render();
}

function bindLookupEvents() {
  const nameInput = document.querySelector("[data-lookup-name]");
  const phoneInput = document.querySelector("[data-lookup-phone]");
  nameInput?.addEventListener("input", (event) => {
    appState.lookupName = event.target.value;
  });
  phoneInput?.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
    appState.lookupPhone = event.target.value;
  });
  document.querySelector("[data-lookup]")?.addEventListener("click", () => {
    const m = messages();
    const name = (appState.lookupName || "").trim();
    const phone = formatPhone(appState.lookupPhone || "");
    appState.lookupResult = null;
    appState.lookupMessage = "";
    if (!validateName(name)) appState.lookupMessage = m.validation.name;
    else if (!validatePhone(phone)) appState.lookupMessage = m.validation.phone;
    else {
      const normalized = normalizePhone(phone);
      appState.lookupResult = getSavedReservations().find((reservation) =>
        (reservation.guests || []).some((guest) => guest.name.trim() === name && normalizePhone(guest.phone) === normalized)
      );
      if (!appState.lookupResult) appState.lookupMessage = m.lookupFail;
    }
    render();
  });
}

window.addEventListener("popstate", () => {
  appState.route = normalizePath(window.location.pathname);
  render();
});

document.documentElement.lang = appState.lang;
if (appState.route === "/guest-reservation") initReservation();
render();
