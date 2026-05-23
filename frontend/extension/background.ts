type RequestMessage = {
  type: "nautilus:request";
  input: {
    url: string;
    init?: RequestInit;
  };
};

type ProbeLocalMessage = {
  type: "nautilus:probe-local";
  input: {
    localApi: string;
  };
};

type OpenUrlMessage = {
  type: "nautilus:open-url";
  input: {
    url: string;
  };
};

type ExtensionMessage =
  | RequestMessage
  | ProbeLocalMessage
  | OpenUrlMessage;

async function proxyRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    text,
  };
}

async function probeLocal(localApi: string) {
  try {
    await fetch(localApi, {
      method: "GET",
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as ExtensionMessage;

  if (message.type === "nautilus:request") {
    void proxyRequest(message.input.url, message.input.init)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          status: 0,
          text: error instanceof Error ? error.message : "request failed",
        });
      });
    return true;
  }

  if (message.type === "nautilus:probe-local") {
    void probeLocal(message.input.localApi).then(sendResponse);
    return true;
  }

  if (message.type === "nautilus:open-url") {
    void chrome.tabs.create({ url: message.input.url }).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
