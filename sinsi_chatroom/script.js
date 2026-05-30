document.addEventListener("onLoad", function () {
  // Streamlabs chat widget appends messages from #chatlist_item automatically.
  decorateExistingMessages();
  observeMessages();
});

document.addEventListener("onEventReceived", function () {
  // Keep this listener available for Streamlabs widget events.
  window.setTimeout(decorateExistingMessages, 0);
});

function observeMessages() {
  const log = document.getElementById("log");
  if (!log) return;

  const observer = new MutationObserver(decorateExistingMessages);
  observer.observe(log, { childList: true, subtree: true });
}

function decorateExistingMessages() {
  document.querySelectorAll("#log > div:not([data-decorated])").forEach((message) => {
    message.dataset.decorated = "true";
    message.classList.add("chat-message");

    const badgeText = Array.from(message.querySelectorAll(".badge, .badges img"))
      .map((badge) => `${badge.alt || ""} ${badge.title || ""} ${badge.src || ""}`)
      .join(" ")
      .toLowerCase();

    if (!message.querySelector(".chat-icon")) {
      message.insertAdjacentHTML("afterbegin", `<span class="chat-icon" aria-hidden="true">${jellyIcon()}</span>`);
    }

    if (badgeText.includes("moderator") || badgeText.includes("mod")) {
      setIcon(message, starIcon());
    } else if (badgeText.includes("subscriber") || badgeText.includes("sub")) {
      setIcon(message, shellIcon());
    } else {
      const variant = Array.from(message.parentElement.children).indexOf(message) % 3;
      if (variant === 1) {
        setIcon(message, starIcon());
      } else if (variant === 2) {
        setIcon(message, shellIcon());
      } else {
        setIcon(message, jellyIcon());
      }
    }
  });
}

function setIcon(message, icon) {
  const target = message.querySelector(".chat-icon");
  if (target) target.innerHTML = icon;
}

function starIcon() {
  return `
    <svg viewBox="0 0 64 64">
      <path class="mini-star" d="M32 7 C37 7 39 20 43 24 C47 27 59 26 61 31 C63 36 50 42 48 46 C45 50 50 61 45 63 C40 65 35 53 31 52 C27 50 17 58 13 55 C9 51 18 42 18 38 C18 33 8 27 11 22 C14 18 26 23 29 20 C33 18 27 7 32 7Z"></path>
      <circle class="mini-dot" cx="31" cy="33" r="3"></circle>
      <circle class="mini-dot" cx="24" cy="40" r="2"></circle>
      <circle class="mini-dot" cx="40" cy="41" r="2"></circle>
    </svg>
  `;
}

function jellyIcon() {
  return `
    <svg viewBox="0 0 64 64">
      <path class="mini-jelly-bell" d="M13 31 C13 14 22 7 33 7 C45 7 52 16 52 32 C45 42 22 42 13 31Z"></path>
      <path class="mini-line" d="M16 31 C22 38 27 29 32 36 C38 43 44 30 51 32"></path>
      <path class="mini-jelly-line" d="M22 38 C15 48 23 53 18 61 M31 39 C27 49 35 53 31 62 M40 38 C47 48 39 53 44 61"></path>
    </svg>
  `;
}

function shellIcon() {
  return `
    <svg viewBox="0 0 64 64">
      <path class="mini-shell" d="M9 52 C10 26 20 12 32 10 C46 11 55 27 55 52Z"></path>
      <path class="mini-shell-base" d="M9 52 C22 57 43 57 55 52 C53 60 12 60 9 52Z"></path>
      <path class="mini-line" d="M32 12 V55 M22 18 C25 29 26 41 25 55 M42 18 C39 30 38 42 39 55 M14 34 C20 40 22 47 22 55 M50 34 C44 40 42 47 42 55"></path>
    </svg>
  `;
}
