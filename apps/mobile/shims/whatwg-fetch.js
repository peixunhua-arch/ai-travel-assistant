/**
 * RN 0.81 + Hermes：XMLHttpRequest 派发 Event 时会触发
 * “Cannot assign to read-only property 'NONE'”。
 * 因此这里用 RCTNetworking 原生通道实现 fetch，完全绕开 XHR/Event。
 */
(function installNativeFetch() {
  const g =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof global !== 'undefined' && global) ||
    {};

  let RCTNetworking;
  try {
    RCTNetworking = require('react-native/Libraries/Network/RCTNetworking').default;
  } catch (e) {
    // 极少数环境无此模块时保持现状
    return;
  }

  function HeadersPolyfill(init) {
    this._map = {};
    if (!init) return;
    if (typeof Headers !== 'undefined' && init instanceof Headers) {
      init.forEach((v, k) => {
        this._map[String(k).toLowerCase()] = String(v);
      });
      return;
    }
    if (Array.isArray(init)) {
      for (const pair of init) {
        if (pair && pair.length >= 2) {
          this._map[String(pair[0]).toLowerCase()] = String(pair[1]);
        }
      }
      return;
    }
    if (typeof init === 'object') {
      for (const k of Object.keys(init)) {
        this._map[String(k).toLowerCase()] = String(init[k]);
      }
    }
  }
  HeadersPolyfill.prototype.append = function append(name, value) {
    const key = String(name).toLowerCase();
    if (this._map[key]) this._map[key] += ', ' + String(value);
    else this._map[key] = String(value);
  };
  HeadersPolyfill.prototype.set = function set(name, value) {
    this._map[String(name).toLowerCase()] = String(value);
  };
  HeadersPolyfill.prototype.get = function get(name) {
    const v = this._map[String(name).toLowerCase()];
    return v === undefined ? null : v;
  };
  HeadersPolyfill.prototype.has = function has(name) {
    return Object.prototype.hasOwnProperty.call(this._map, String(name).toLowerCase());
  };
  HeadersPolyfill.prototype.delete = function del(name) {
    delete this._map[String(name).toLowerCase()];
  };
  HeadersPolyfill.prototype.forEach = function forEach(cb, thisArg) {
    for (const k of Object.keys(this._map)) {
      cb.call(thisArg, this._map[k], k, this);
    }
  };
  HeadersPolyfill.prototype._asObject = function _asObject() {
    const out = {};
    for (const k of Object.keys(this._map)) out[k] = this._map[k];
    return out;
  };

  function ResponsePolyfill(bodyText, options) {
    options = options || {};
    this._bodyText = bodyText == null ? '' : String(bodyText);
    this.status = options.status == null ? 200 : options.status;
    this.statusText = options.statusText || '';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = options.headers || new HeadersPolyfill();
    this.url = options.url || '';
    this.type = 'basic';
  }
  ResponsePolyfill.prototype.clone = function clone() {
    return new ResponsePolyfill(this._bodyText, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      url: this.url,
    });
  };
  ResponsePolyfill.prototype.text = function text() {
    return Promise.resolve(this._bodyText);
  };
  ResponsePolyfill.prototype.json = function json() {
    return this.text().then(function (t) {
      return JSON.parse(t);
    });
  };

  function nativeFetch(input, init) {
    init = init || {};
    const url = typeof input === 'string' ? input : input && input.url;
    if (!url) return Promise.reject(new TypeError('Failed to fetch: missing url'));

    const method = (init.method || 'GET').toUpperCase();
    const headers = new HeadersPolyfill(init.headers);
    const body = init.body == null ? '' : init.body;
    const signal = init.signal;
    const timeout = typeof init.timeout === 'number' ? init.timeout : 0;

    return new Promise(function (resolve, reject) {
      let requestId = null;
      let status = 0;
      let responseURL = url;
      let responseHeaders = {};
      let responseText = '';
      let settled = false;

      const subs = [];
      const cleanup = function () {
        while (subs.length) {
          const s = subs.pop();
          try {
            s.remove();
          } catch (_) {
            /* ignore */
          }
        }
      };

      const finish = function (err, res) {
        if (settled) return;
        settled = true;
        cleanup();
        if (signal && typeof signal.removeEventListener === 'function' && onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
        if (err) reject(err);
        else resolve(res);
      };

      const onAbort = function () {
        if (requestId != null) {
          try {
            RCTNetworking.abortRequest(requestId);
          } catch (_) {
            /* ignore */
          }
        }
        finish(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        if (typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', onAbort);
        }
      }

      subs.push(
        RCTNetworking.addListener('didReceiveNetworkResponse', function (args) {
          const id = args[0];
          if (id !== requestId) return;
          status = args[1];
          responseHeaders = args[2] || {};
          if (args[3]) responseURL = args[3];
        }),
      );
      subs.push(
        RCTNetworking.addListener('didReceiveNetworkData', function (args) {
          const id = args[0];
          if (id !== requestId) return;
          responseText = args[1] == null ? '' : String(args[1]);
        }),
      );
      subs.push(
        RCTNetworking.addListener('didCompleteNetworkResponse', function (args) {
          const id = args[0];
          if (id !== requestId) return;
          const error = args[1];
          const timedOut = args[2];
          if (error) {
            finish(
              new TypeError(timedOut ? 'Network request timed out' : error || 'Network request failed'),
            );
            return;
          }
          finish(
            null,
            new ResponsePolyfill(responseText, {
              status: status,
              headers: new HeadersPolyfill(responseHeaders),
              url: responseURL,
            }),
          );
        }),
      );

      try {
        RCTNetworking.sendRequest(
          method,
          undefined,
          url,
          headers._asObject(),
          body,
          'text',
          false,
          timeout,
          function (id) {
            requestId = id;
          },
          false,
        );
      } catch (e) {
        finish(e);
      }
    });
  }

  g.fetch = nativeFetch;
  g.Headers = HeadersPolyfill;
  g.Response = ResponsePolyfill;
  if (typeof g.Request === 'undefined') {
    g.Request = function Request(input, init) {
      this.url = typeof input === 'string' ? input : input && input.url;
      this.method = (init && init.method) || 'GET';
      this.headers = new HeadersPolyfill(init && init.headers);
      this.body = init && init.body;
      this.signal = init && init.signal;
    };
  }
})();
