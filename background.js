const encryption = {
  encrypt(v) {
    return v;
  },
  decrypt(v) {
    return v;
  },
};

class User {
  _initialized = false;
  _authenticated = false;
  _secret;

  get authenticated() {
    return this._authenticated;
  }

  get secret() {
    return this._secret;
  }

  get initialized() {
    return this._initialized;
  }

  state() {
    return { secret: this.secret, initialized: this.initialized, authenticated: this.authenticated };
  }

  sign_in() {
    this._authenticated = true;
  }

  sign_out() {
    this._authenticated = false;
  }

  async init() {
    const INITIALIZED = true;
    await chrome.storage.sync.set({ INITIALIZED });
    this._initialized = INITIALIZED;
  }

  async set_secret(payload) {
    await chrome.storage.sync.set({ SECRET: encryption.encrypt(payload) });
    this._secret = payload;
  }

  reset() {
    chrome.storage.sync.clear(() => {
      this._initialized = false;
      this._secret = undefined;
      this._authenticated = false;
    });
  }

  load() {
    chrome.storage.sync.get(["SECRET", "INITIALIZED"]).then((result) => {
      const { SECRET, INITIALIZED } = result;
      if (SECRET) this._secret = encryption.decrypt(SECRET);
      if (INITIALIZED) this._initialized = INITIALIZED;
    });
  }
}

const user = new User();

// https://developer.chrome.com/docs/extensions/reference/runtime/#event-onConnect
chrome.runtime.onConnect.addListener(function (port) {
  port.onMessage.addListener((msg) => {
    const action = msg.action;

    const sendState = () =>
      port.postMessage({
        action: "SET_STATE",
        payload: user.state(),
      });

    if (action === "GET_STATE") sendState();

    if (action === "STORE_SECRET") user.set_secret(msg.payload);

    if (action === "INIT") user.init();

    if (action === "SIGN_IN") user.sign_in();

    if (action === "SIGN_OUT") user.sign_out();

    if (action === "RESET") user.reset();
  });
});

// https://developer.chrome.com/docs/extensions/reference/runtime/#event-onStartup
chrome.runtime.onStartup.addListener(() => {
  user.load();
});

// https://developer.chrome.com/docs/extensions/reference/runtime/#event-onInstalled
chrome.runtime.onInstalled.addListener(() => {
  // open popup dynamically
});
