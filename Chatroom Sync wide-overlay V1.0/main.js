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
    "#72ff8c",
    "#ff9f43",
    "#8ea7ff",
    "#ff6f91",
    "#65ffd0",
    "#c78cff",
    "#ffd166",
    "#f7ff65"
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
    var value = normalizeUsername(username).toLowerCase();

    return (
      value === "" ||
      value === "chat" ||
      value === "tmi.twitch.tv" ||
      value === "jtv" ||
      value.indexOf("tmi.twitch.tv") !== -1 ||
      value.indexOf(".twitch.tv") !== -1 ||
      value.indexOf("streamlabs") !== -1
    );
  }

  function cleanMessageHtml(message) {
    var html = String(message || "");

    html = html.replace(/^\s*:?\s*@?tmi\.twitch\.tv\s*:\s*/i, "");
    html = html.replace(/^\s*:?\s*@?tmi\.twitch\.tv\s+/i, "");
    html = html.replace(/^\s*:?\s*jtv\s*:\s*/i, "");

    return html.trim();
  }

  function isSystemMessage(message) {
    var text = String(message || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    return (
      text === "" ||
      text.indexOf("tmi.twitch.tv") !== -1 ||
      text.indexOf("twitch.tv/tags") !== -1 ||
      text.indexOf("twitch.tv/commands") !== -1 ||
      text.indexOf("twitch.tv/membership") !== -1 ||
      text.indexOf("cap * ack") !== -1 ||
      text.indexOf("cap req") !== -1 ||
      text.indexOf("globaluserstate") !== -1 ||
      text.indexOf("roomstate") !== -1 ||
      text.indexOf("userstate") !== -1 ||
      text.indexOf("clearchat") !== -1 ||
      text.indexOf("clearmsg") !== -1 ||
      text.indexOf("hosttarget") !== -1 ||
      text.indexOf("reconnect") !== -1 ||
      text.indexOf("notice") === 0 ||
      text.indexOf("ping") === 0 ||
      text.indexOf("pong") === 0
    );
  }

  function isValidUsername(username) {
    var value = normalizeUsername(username);

    return (
      value &&
      !isSystemUsername(value) &&
      value.length <= 32 &&
      /^[a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u9fff]+$/.test(value)
    );
  }

  function pickFirstExisting() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") {
        return arguments[i];
      }
    }

    return "";
  }

  function getNestedValue(object, path) {
    var current = object;

    for (var i = 0; i < path.length; i += 1) {
      if (!current || current[path[i]] === undefined || current[path[i]] === null) {
        return "";
      }

      current = current[path[i]];
    }

    return current;
  }

  function pickUsernameFromList(list) {
    for (var i = 0; i < list.length; i += 1) {
      var candidate = normalizeUsername(list[i]);

      if (isValidUsername(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  function findUsernameDeep(source) {
    var usernameKeys = {
      displayName: true,
      display_name: true,
      username: true,
      userName: true,
      user_name: true,
      login: true,
      nick: true,
      sender: true,
      from: true,
      user: true,
      name: true
    };

    var queue = [source];
    var checked = 0;

    while (queue.length && checked < 200) {
      var item = queue.shift();
      checked += 1;

      if (!item || typeof item !== "object") {
        continue;
      }

      for (var key in item) {
        if (!Object.prototype.hasOwnProperty.call(item, key)) {
          continue;
        }

        if (usernameKeys[key] && isValidUsername(item[key])) {
          return normalizeUsername(item[key]);
        }

        if (item[key] && typeof item[key] === "object") {
          queue.push(item[key]);
        }
      }
    }

    return "";
  }

  function extractUsernameFromRawIrc(source) {
    var text = String(source || "");
    var match = text.match(/:([a-zA-Z0-9_]{2,32})![^ ]+\s+PRIVMSG/i);

    if (match && isValidUsername(match[1])) {
      return normalizeUsername(match[1]);
    }

    return "";
  }

  function extractUsernameFromMessage(message) {
    var plain = String(message || "").replace(/<[^>]*>/g, "");
    var match = plain.match(/^\s*([a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u9fff]{2,32})\s*:\s+/);

    if (match && isValidUsername(match[1])) {
      return normalizeUsername(match[1]);
    }

    return "";
  }

  function stripUsernamePrefixFromMessage(message, username) {
    var html = String(message || "");
    var safeName = String(username || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (!safeName) {
      return html;
    }

    return html.replace(new RegExp("^\\s*" + safeName + "\\s*:\\s*", "i"), "");
  }

  function hashUsername(username) {
    var hash = 0;
    var text = String(username || "chat");

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

  window.addMessage = function addMessage(username, message) {
    if (!chatMessages) {
      return;
    }

    var displayName = normalizeUsername(username || "chat");
    var rawMessageHtml = cleanMessageHtml(message);

    if (!rawMessageHtml || isSystemMessage(rawMessageHtml)) {
      return;
    }

    var embeddedUsername = extractUsernameFromMessage(rawMessageHtml);

    if (displayName === "chat" && embeddedUsername) {
      displayName = embeddedUsername;
      rawMessageHtml = stripUsernamePrefixFromMessage(rawMessageHtml, embeddedUsername);
    }

    if (isSystemUsername(displayName)) {
      displayName = "chat";
    }

    rawMessageHtml = cleanMessageHtml(rawMessageHtml);

    if (!rawMessageHtml || isSystemMessage(rawMessageHtml)) {
      return;
    }

    var safeUsername = escapeHtml(displayName);
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
      return cleanMessageHtml(getMessageHtmlFromParts(message));
    }

    if (typeof message === "object" && message !== null) {
      return cleanMessageHtml(pickFirstExisting(
        message.html,
        message.renderedText,
        message.text,
        message.message,
        message.name
      ));
    }

    return cleanMessageHtml(message);
  }

  function getChatPayload(obj) {
    if (!obj || !obj.detail) {
      return null;
    }

    var detail = obj.detail || {};
    var event = detail.event || {};
    var data = event.data || detail.data || event || {};
    var message = getMessageHtml(data, event, detail);

    if (!message || isSystemMessage(message)) {
      return null;
    }

    var username = pickUsernameFromList([
      getNestedValue(data, ["tags", "display-name"]),
      getNestedValue(data, ["tags", "login"]),
      getNestedValue(data, ["badges", "display-name"]),
      getNestedValue(data, ["userstate", "display-name"]),
      getNestedValue(data, ["userstate", "username"]),

      getNestedValue(event, ["tags", "display-name"]),
      getNestedValue(event, ["tags", "login"]),
      getNestedValue(event, ["userstate", "display-name"]),
      getNestedValue(event, ["userstate", "username"]),

      data.displayName,
      data.display_name,
      data.userName,
      data.username,
      data.user_name,
      data.login,
      data.nick,
      data.sender,
      data.from,
      data.user,
      data.name,

      event.displayName,
      event.display_name,
      event.userName,
      event.username,
      event.user_name,
      event.login,
      event.nick,
      event.sender,
      event.from,
      event.user,
      event.name,

      detail.displayName,
      detail.display_name,
      detail.userName,
      detail.username,
      detail.user_name,
      detail.login,
      detail.nick,
      detail.sender,
      detail.from,
      detail.user,
      detail.name
    ]);

    if (!username) {
      username =
        findUsernameDeep(data) ||
        findUsernameDeep(event) ||
        findUsernameDeep(detail) ||
        extractUsernameFromRawIrc(JSON.stringify(data)) ||
        extractUsernameFromRawIrc(JSON.stringify(event)) ||
        extractUsernameFromRawIrc(JSON.stringify(detail)) ||
        extractUsernameFromMessage(message) ||
        "chat";
    }

    if (username !== "chat") {
      message = stripUsernamePrefixFromMessage(message, username);
    }

    message = cleanMessageHtml(message);

    if (!message || isSystemMessage(message)) {
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

    if (!payload) {
      return;
    }

    if (isDuplicateMessage(payload)) {
      return;
    }

    window.addMessage(payload.username, payload.message);
  }

  document.addEventListener("onEventReceived", handleStreamlabsEvent);

  if (TEST_MODE) {
    window.addMessage("Astra", "同步訊號穩定，畫面很乾淨 ✨");
    window.addMessage("NeoKai", "收到，聊天室連線已建立。");
    window.addMessage("Mira", '圖片表情測試 <img class="emoji" alt="Kappa" src="https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0">');
  }
}());
