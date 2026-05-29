(function () {
  "use strict";

  var TEST_MODE = false;
  var MAX_MESSAGES = 18;
  var DUPLICATE_WINDOW_MS = 1200;

  var chatMessages = document.getElementById("chatMessages");
  var handledEventKeys = [];

  var usernameColors = [
    "#2bfff5",
    "#ff5cf4",
    "#f7ff65",
    "#72ff8c",
    "#ff9f43",
    "#8ea7ff",
    "#ff6f91",
    "#65ffd0",
    "#c78cff",
    "#ffd166"
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .replace(/:+$/, "")
      .trim();
  }

  function isSystemUsername(username) {
    var normalized = normalizeUsername(username).toLowerCase();

    return (
      normalized === "" ||
      normalized === "tmi.twitch.tv" ||
      normalized === "jtv" ||
      normalized.indexOf("tmi.twitch.tv") !== -1 ||
      normalized.indexOf(".twitch.tv") !== -1
    );
  }

  function pickUsername() {
    for (var i = 0; i < arguments.length; i += 1) {
      var candidate = normalizeUsername(arguments[i]);

      if (candidate && !isSystemUsername(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  function hashUsername(username) {
    var hash = 0;
    var text = String(username || "anonymous");

    for (var i = 0; i < text.length; i += 1) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }

    return Math.abs(hash);
  }

  function getUsernameColor(username) {
    return usernameColors[hashUsername(username) % usernameColors.length];
  }

  function getCurrentTime() {
    var now = new Date();
    var hours = String(now.getHours()).padStart(2, "0");
    var minutes = String(now.getMinutes()).padStart(2, "0");

    return hours + ":" + minutes;
  }

  function trimMessages() {
    while (chatMessages && chatMessages.children.length > MAX_MESSAGES) {
      chatMessages.removeChild(chatMessages.firstElementChild);
    }
  }

  function pickFirstExisting() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") {
        return arguments[i];
      }
    }

    return "";
  }

  window.addMessage = function addMessage(username, message) {
    if (!chatMessages || isSystemUsername(username)) {
      return;
    }

    var displayName = normalizeUsername(username);
    var safeUsername = escapeHtml(displayName);
    var rawMessageHtml = String(message || "");
    var usernameColor = getUsernameColor(displayName);

    var line = document.createElement("div");
    line.className = "chat-line";

    line.innerHTML =
      '<span class="timestamp">[' + getCurrentTime() + '] </span>' +
      '<span class="username" style="color: ' + usernameColor + ';">' + safeUsername + '</span>' +
      '<span class="message">: ' + rawMessageHtml + '</span>';

    chatMessages.appendChild(line);
    trimMessages();
  };

  function getMessageHtmlFromParts(parts) {
    if (!Array.isArray(parts)) {
      return "";
    }

    return parts.map(function (part) {
      if (typeof part === "string") {
        return part;
      }

      if (!part) {
        return "";
      }

      if (part.html) {
        return part.html;
      }

      if (part.type === "emote" && part.url) {
        return '<img class="emoji" alt="' + escapeHtml(part.name || "") + '" src="' + escapeHtml(part.url) + '">';
      }

      return pickFirstExisting(
        part.renderedText,
        part.message,
        part.text,
        part.name
      );
    }).join("");
  }

  function getMessageHtml(data, event, detail) {
    var message = pickFirstExisting(
      data.renderedText,
      data.message,
      data.body,
      data.text,
      data.html,
      data.msg,
      data.comment,
      event.renderedText,
      event.message,
      event.body,
      event.text,
      event.html,
      event.msg,
      event.comment,
      detail.renderedText,
      detail.message,
      detail.body,
      detail.text,
      detail.html,
      detail.msg,
      detail.comment
    );

    if (!message && Array.isArray(data.parts)) {
      message = getMessageHtmlFromParts(data.parts);
    }

    if (!message && Array.isArray(event.parts)) {
      message = getMessageHtmlFromParts(event.parts);
    }

    if (!message && Array.isArray(detail.parts)) {
      message = getMessageHtmlFromParts(detail.parts);
    }

    if (Array.isArray(message)) {
      return getMessageHtmlFromParts(message);
    }

    if (typeof message === "object" && message !== null) {
      return pickFirstExisting(
        message.html,
        message.renderedText,
        message.text,
        message.message,
        message.name
      );
    }

    return String(message || "");
  }

  function getChatPayload(obj) {
    if (!obj || !obj.detail) {
      return null;
    }

    var detail = obj.detail || {};
    var event = detail.event || {};
    var data = event.data || detail.data || event || {};

    var message = getMessageHtml(data, event, detail);

    var username = pickUsername(
      data.displayName,
      data.display_name,
      data.user,
      data.userName,
      data.username,
      data.nick,
      data.sender,
      data.name,
      event.displayName,
      event.display_name,
      event.user,
      event.userName,
      event.username,
      event.nick,
      event.sender,
      event.name,
      detail.displayName,
      detail.display_name,
      detail.user,
      detail.userName,
      detail.username,
      detail.nick,
      detail.sender,
      detail.name
    );

    if (!message || !username || isSystemUsername(username)) {
      return null;
    }

    return {
      username: username,
      message: message
    };
  }

  function isDuplicateMessage(payload) {
    var now = Date.now();
    var key = payload.username + "|" + payload.message;

    handledEventKeys = handledEventKeys.filter(function (item) {
      return now - item.time < DUPLICATE_WINDOW_MS;
    });

    for (var i = 0; i < handledEventKeys.length; i += 1) {
      if (handledEventKeys[i].key === key) {
        return true;
      }
    }

    handledEventKeys.push({
      key: key,
      time: now
    });

    return false;
  }

  function handleStreamlabsEvent(obj) {
    var payload = getChatPayload(obj);

    if (!payload || isSystemUsername(payload.username)) {
      return;
    }

    if (isDuplicateMessage(payload)) {
      return;
    }

    window.addMessage(payload.username, payload.message);
  }

  document.addEventListener("onEventReceived", handleStreamlabsEvent);

  if (TEST_MODE) {
    var testMessages = [
      {
        username: "Astra",
        message: "同步訊號穩定，畫面很乾淨 ✨"
      },
      {
        username: "NeoKai",
        message: "收到，聊天室連線已建立。"
      },
      {
        username: "Mira",
        message: '圖片表情測試 <img class="emoji" alt="Kappa" src="https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0">'
      },
      {
        username: "Echo_07",
        message: "STATUS: ONLINE 🟢"
      },
      {
        username: "Luna",
        message: "有人看到這行嗎？👀"
      }
    ];

    var fakeMessages = [
      {
        username: "ByteFox",
        message: "cyan glow 看起來剛剛好。"
      },
      {
        username: "Orbit",
        message: "PAGE: 00000 仍然鎖定。"
      },
      {
        username: "Kuro",
        message: "支援 emoji，也保留圖片表情 😎"
      },
      {
        username: "Nova",
        message: "終端同步完成。"
      }
    ];

    var fakeIndex = 0;

    testMessages.forEach(function (item) {
      window.addMessage(item.username, item.message);
    });

    setInterval(function () {
      var item = fakeMessages[fakeIndex % fakeMessages.length];
      window.addMessage(item.username, item.message);
      fakeIndex += 1;
    }, 2000);
  }
}());
