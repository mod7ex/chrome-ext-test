const LENGTH = 40;

const secretGen = () => {
  // 33 --> 126
  const seed = [];

  for (let i = 0; i < LENGTH; i++) {
    let int = Math.floor(33 + (126 + 1 - 33) * Math.random());

    seed.push(String.fromCharCode(int));
  }

  return seed.join("");
};

class State {
  _idle = true;
  _secret;
  _initialized = false;
  _authenticated = false;
  _subscribers = new Set();

  get authenticated() {
    return this._authenticated;
  }

  get secret() {
    return this._secret;
  }

  get initialized() {
    return this._initialized;
  }

  get idle() {
    return this._idle;
  }

  sleep() {
    this._idle = false;
  }

  wake() {
    this._idle = true;
  }

  set(payload) {
    this._secret = payload.secret;
    this._initialized = payload.initialized;
    this._authenticated = payload.authenticated;
    this.notify();
  }

  subscribe(fn) {
    this._subscribers.add(fn);
  }

  notify() {
    this._subscribers.forEach((fn) =>
      fn({
        initialized: this.initialized,
        secret: this.secret,
        authenticated: this.authenticated,
      })
    );
  }
}

const showPage = (target) => {
  // TODO: loop and change class based on target
  document.querySelectorAll(".page").forEach((el) => el.classList.add("hidden"));
  document.querySelector(target).classList.remove("hidden");
};

const showSecretPage = ({ secret_str, title, onProceed, onLogout, onRegenerate }) => {
  showPage(".secret_page");

  const secret = document.createElement("p");
  secret.classList.add("secret");
  secret.innerText = secret_str;

  const secretEl = document.getElementById("secret");

  secretEl.innerHTML = "";
  secretEl.appendChild(secret);
  document.querySelector(".secret_title").innerText = title;

  const next_btn = document.getElementById("next_btn");
  const regenerate_btn = document.getElementById("regenerate");
  const logout_btn = document.getElementById("logout");

  regenerate_btn.classList.add("hidden");
  logout_btn.classList.add("hidden");
  next_btn.classList.add("hidden");

  if (onProceed) {
    next_btn.classList.remove("hidden");
    next_btn.addEventListener("click", () => {
      onProceed?.();
    });
  }

  if (onLogout) {
    logout_btn.classList.remove("hidden");
    logout_btn.addEventListener("click", () => {
      onLogout?.();
    });
  }

  if (onRegenerate) {
    regenerate_btn.classList.remove("hidden");
    regenerate_btn.addEventListener("click", () => {
      onRegenerate?.();
    });
  }
};

const showAuthPage = ({ onAuth, title, onReset }) => {
  showPage(".auth_page");

  const form = document.getElementById("password_form");

  document.querySelector(".auth_form_title").innerText = title;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const password = formData.get("password");
    const password_confirmation = formData.get("password_confirmation");

    if (password === password_confirmation) {
      form.reset();
      onAuth?.();
    }
  });

  const reset_btn = document.getElementById("reset");

  if (onReset) {
    reset_btn.classList.remove("hidden");
    reset_btn.addEventListener("click", onReset);
  } else {
    reset_btn.classList.add("hidden");
  }
};

/* ----------------------------------------------------------------------------------- */

const PORT = chrome.runtime.connect(chrome.runtime.id);

const state = new State();

PORT.onMessage.addListener((msg) => {
  const action = msg.action;

  if (action === "SET_STATE") {
    state.wake();
    state.set(msg.payload);
  }
});

const reRender = () => {
  state.sleep();
  PORT.postMessage({ action: "GET_STATE" });
};

const protect = (fn) => {
  return (...args) => {
    if (state.idle) {
      fn?.(...args);
    }
  };
};

state.subscribe(({ initialized, secret, authenticated }) => {
  if (initialized) {
    if (authenticated) {
      showSecretPage({
        title: "Your secret key",
        secret_str: secret,
        onLogout: () => {
          PORT.postMessage({ action: "SIGN_OUT" });
          reRender();
        },
        onRegenerate: protect(() => {
          const payload = secretGen();
          state.sleep();
          PORT.postMessage({ action: "STORE_SECRET", payload });
          // TODO wait for background response then render
          setTimeout(() => {
            reRender();
          }, 1000);
        }),
      });
    } else {
      showAuthPage({
        title: "Login",
        onAuth: () => {
          PORT.postMessage({ action: "SIGN_IN" });
          reRender();
        },
        onReset: () => {
          PORT.postMessage({ action: "RESET" });
          window.close();
        },
      });
    }
  } else {
    const payload = secretGen();

    showSecretPage({
      title: "Click next to initialize app",
      secret_str: payload,
      onProceed: () => {
        showAuthPage({
          title: "Enter password in order to initialize app",
          onAuth: protect(() => {
            state.sleep();
            PORT.postMessage({ action: "STORE_SECRET", payload });
            PORT.postMessage({ action: "INIT" });
            window.close();
          }),
        });
      },
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  reRender();
});
