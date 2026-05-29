var MAX_MESSAGES = 18;

function getCurrentTime() {
  var now = new Date();
  var hours = String(now.getHours()).padStart(2, "0");
  var minutes = String(now.getMinutes()).padStart(2, "0");

  return hours + ":" + minutes;
}

function enhanceChatLine(line) {
  if (!line || line.dataset.enhanced === "true") {
    return;
  }

  var timestamp = line.querySelector(".timestamp");

  if (timestamp && !timestamp.textContent.trim()) {
    timestamp.textContent = "[" + getCurrentTime() + "] ";
  }

  line.dataset.enhanced = "true";
}

function trimMessages() {
  var log = document.getElementById("log");

  if (!log) {
    return;
  }

  while (log.children.length > MAX_MESSAGES) {
    log.removeChild(log.firstElementChild);
  }
}

function enhanceExistingMessages() {
  var log = document.getElementById("log");

  if (!log) {
    return;
  }

  Array.prototype.forEach.call(log.children, function (line) {
    enhanceChatLine(line);
  });

  trimMessages();
}

document.addEventListener("onLoad", function () {
  enhanceExistingMessages();

  var log = document.getElementById("log");

  if (!log) {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function (node) {
        if (node.nodeType === 1) {
          enhanceChatLine(node);
        }
      });
    });

    trimMessages();
  });

  observer.observe(log, {
    childList: true
  });
});

document.addEventListener("onEventReceived", function () {
  setTimeout(enhanceExistingMessages, 0);
});
